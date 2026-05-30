const prisma = require('../lib/prisma.js');
const { tenantIdFromReq } = require('../lib/tenantHelpers');

const normalizePhone = (phone) => {
  if (!phone) return '';
  return String(phone).replace(/\D/g, '');
};

const PAID_STATUSES = ['Finalizado', 'Concluido', 'Concluído', 'Pago', 'Realizado'];
const FUTURE_OPEN_STATUSES = ['Agendado', 'Confirmado', 'Pendente'];

const isPaidAppointment = (appt) => PAID_STATUSES.includes(appt?.status);
const isFutureOpenAppointment = (appt) => FUTURE_OPEN_STATUSES.includes(appt?.status);

const todayIso = () => new Date().toISOString().slice(0, 10);

const parseTags = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean).map(String);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
    } catch {
      return raw.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
};

const aggregateAppointments = (appointments) => {
  let lastVisit = null;
  let nextAppointment = null;
  let totalSpent = 0;
  let visitCount = 0;
  let lastService = null;

  const today = todayIso();

  for (const appt of appointments) {
    if (isPaidAppointment(appt)) {
      visitCount += 1;
      totalSpent += Number(appt.price || 0);
      if (!lastVisit || appt.date > lastVisit) {
        lastVisit = appt.date;
        lastService = appt.service;
      }
    }
    if (isFutureOpenAppointment(appt) && appt.date >= today) {
      if (!nextAppointment || appt.date < nextAppointment.date) {
        nextAppointment = { date: appt.date, time: appt.time, service: appt.service };
      }
    }
  }

  return { lastVisit, nextAppointment, totalSpent, visitCount, lastService };
};

const computeStatus = ({ lastVisit, nextAppointment, visitCount }, inactiveDays = 60) => {
  if (visitCount === 0 && !nextAppointment) return 'Novo';
  if (!lastVisit && nextAppointment) return 'Pendente';
  if (lastVisit) {
    const diffDays = Math.floor((Date.now() - new Date(lastVisit).getTime()) / 86400000);
    if (diffDays <= inactiveDays) return 'Ativo';
    return 'Inativo';
  }
  return 'Novo';
};

/** null = todos (Gerente); número = só dados desse barbeiro */
const barberIdFilterForRequest = (req) => {
  if (!req.user) return null;
  if (req.user.role === 'Gerente') return null;
  return Number(req.user.id);
};

// Combina Customers oficiais com agendamentos avulsos.
// Chave de merge: telefone normalizado quando disponível, senão "name|phone".
// `barberIdFilter`: quando definido, só agendamentos desse barbeiro entram no índice.
const buildClientsIndex = async ({ tenantId, barberIdFilter } = {}) => {
  const apptWhere = { tenantId };
  if (barberIdFilter != null) apptWhere.barberId = Number(barberIdFilter);
  const appointments = await prisma.appointment.findMany({ where: apptWhere });

  const linkedCustomerIds = [...new Set(appointments.map((a) => a.customer_id).filter((x) => x != null))];

  let customers;
  if (barberIdFilter != null) {
    customers =
      linkedCustomerIds.length > 0
        ? await prisma.customer.findMany({ where: { tenantId, id: { in: linkedCustomerIds } } })
        : [];
  } else {
    customers = await prisma.customer.findMany({ where: { tenantId } });
  }

  const index = new Map();

  const keyFromPhone = (phone, fallbackName) => {
    const norm = normalizePhone(phone);
    return norm ? `phone:${norm}` : `name:${(fallbackName || '').trim().toLowerCase()}`;
  };

  for (const c of customers) {
    const key = keyFromPhone(c.phone, c.name);
    index.set(key, {
      id: c.id,
      source: 'customer',
      name: c.name,
      email: c.email || null,
      phone: c.phone || '',
      phoneNormalized: normalizePhone(c.phone),
      birthday: c.birthday ? c.birthday.toISOString().slice(0, 10) : null,
      notes: c.notes || '',
      tags: parseTags(c.tags),
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      appointments: []
    });
  }

  for (const appt of appointments) {
    let entry = null;
    if (appt.customer_id) {
      const ownerKey = [...index.entries()].find(([, value]) => value.source === 'customer' && value.id === appt.customer_id);
      if (ownerKey) entry = ownerKey[1];
    }

    if (!entry) {
      const key = keyFromPhone(appt.phone, appt.customer);
      if (index.has(key)) {
        entry = index.get(key);
      } else {
        entry = {
          id: null,
          source: 'guest',
          guestKey: key,
          name: appt.customer || 'Cliente',
          email: null,
          phone: appt.phone || '',
          phoneNormalized: normalizePhone(appt.phone),
          birthday: null,
          notes: '',
          tags: [],
          createdAt: null,
          updatedAt: null,
          appointments: []
        };
        index.set(key, entry);
      }
    }

    entry.appointments.push(appt);
  }

  return [...index.values()].map((entry) => {
    const aggregates = aggregateAppointments(entry.appointments);
    return {
      ...entry,
      ...aggregates,
      averageTicket: aggregates.visitCount > 0 ? aggregates.totalSpent / aggregates.visitCount : 0,
      status: computeStatus(aggregates)
    };
  });
};

const listClients = async (req, res) => {
  try {
    const search = (req.query.search || '').toString().trim().toLowerCase();
    const status = (req.query.status || '').toString().trim();
    const tag = (req.query.tag || '').toString().trim().toLowerCase();
    const page = Math.max(1, parseInt(req.query.page || '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || '10', 10) || 10));

    const all = await buildClientsIndex({
      tenantId: tenantIdFromReq(req),
      barberIdFilter: barberIdFilterForRequest(req),
    });

    const filtered = all.filter((c) => {
      if (status && status !== 'todos' && c.status !== status) return false;
      if (tag && !c.tags.some((t) => t.toLowerCase() === tag)) return false;
      if (search) {
        const target = `${c.name || ''} ${c.email || ''} ${c.phone || ''}`.toLowerCase();
        if (!target.includes(search)) return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      const aTime = a.lastVisit ? new Date(a.lastVisit).getTime() : 0;
      const bTime = b.lastVisit ? new Date(b.lastVisit).getTime() : 0;
      if (bTime !== aTime) return bTime - aTime;
      return (a.name || '').localeCompare(b.name || '');
    });

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize).map((c) => {
      const { appointments, ...rest } = c;
      return { ...rest, appointmentsCount: appointments.length };
    });

    res.json({
      items,
      meta: { total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
    });
  } catch (error) {
    console.error('listClients error:', error);
    res.status(500).json({ message: 'Erro ao listar clientes' });
  }
};

const getClientStats = async (req, res) => {
  try {
    const all = await buildClientsIndex({
      tenantId: tenantIdFromReq(req),
      barberIdFilter: barberIdFilterForRequest(req),
    });
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const monthStart = new Date(thisYear, thisMonth, 1);
    const inactiveCutoff = new Date(now.getTime() - 60 * 86400000);

    const ativos = all.filter((c) => c.status === 'Ativo').length;
    const novosNoMes = all.filter((c) => c.createdAt && new Date(c.createdAt) >= monthStart).length;
    const aniversariantesDoMes = all
      .filter((c) => c.birthday && new Date(c.birthday).getMonth() === thisMonth)
      .map((c) => ({
        id: c.id,
        source: c.source,
        guestKey: c.guestKey,
        name: c.name,
        phone: c.phone,
        birthday: c.birthday
      }));

    const inativos = all
      .filter((c) => c.lastVisit && new Date(c.lastVisit) < inactiveCutoff)
      .sort((a, b) => new Date(a.lastVisit) - new Date(b.lastVisit))
      .slice(0, 20)
      .map((c) => ({
        id: c.id,
        source: c.source,
        guestKey: c.guestKey,
        name: c.name,
        phone: c.phone,
        lastVisit: c.lastVisit,
        totalSpent: c.totalSpent
      }));

    const totalRevenue = all.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
    const totalVisits = all.reduce((sum, c) => sum + (c.visitCount || 0), 0);
    const ticketMedio = totalVisits > 0 ? totalRevenue / totalVisits : 0;

    const top = [...all]
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 5)
      .map((c) => ({
        id: c.id,
        source: c.source,
        guestKey: c.guestKey,
        name: c.name,
        phone: c.phone,
        totalSpent: c.totalSpent,
        visitCount: c.visitCount
      }));

    res.json({
      total: all.length,
      ativos,
      novosNoMes,
      ticketMedio,
      top,
      aniversariantesDoMes,
      inativos
    });
  } catch (error) {
    console.error('getClientStats error:', error);
    res.status(500).json({ message: 'Erro ao calcular estatísticas' });
  }
};

const findClientByKey = async (tenantId, id, guestKey, barberIdFilter) => {
  const all = await buildClientsIndex({ tenantId, barberIdFilter });
  if (id && id !== 'guest') {
    const numericId = Number(id);
    return all.find((c) => c.source === 'customer' && c.id === numericId) || null;
  }
  if (guestKey) {
    return all.find((c) => c.guestKey === guestKey) || null;
  }
  return null;
};

const getClientById = async (req, res) => {
  try {
    const { id } = req.params;
    const guestKey = req.query.guestKey ? String(req.query.guestKey) : null;
    const barberFilter = barberIdFilterForRequest(req);
    const client = await findClientByKey(tenantIdFromReq(req), id, guestKey, barberFilter);

    if (!client) {
      return res.status(404).json({ message: 'Cliente não encontrado' });
    }

    const orParts = [
      ...(client.source === 'customer' && client.id ? [{ customer_id: client.id }] : []),
      ...(client.phoneNormalized
        ? [{ phone: { contains: client.phoneNormalized.slice(-9) } }]
        : []),
      ...(client.name ? [{ customer: client.name }] : []),
    ];

    if (orParts.length === 0) {
      const { appointments, ...rest } = client;
      return res.json({ ...rest, history: [] });
    }

    const tenantId = tenantIdFromReq(req);
    const where =
      barberFilter != null
        ? { tenantId, AND: [{ barberId: barberFilter }, { OR: orParts }] }
        : { tenantId, OR: orParts };

    const enriched = await prisma.appointment.findMany({
      where,
      include: { Barber: { select: { name: true } } },
      orderBy: [{ date: 'desc' }, { time: 'desc' }],
    });

    const dedupedHistory = Array.from(new Map(enriched.map((a) => [a.id, a])).values());

    const { appointments, ...rest } = client;

    res.json({ ...rest, history: dedupedHistory });
  } catch (error) {
    console.error('getClientById error:', error);
    res.status(500).json({ message: 'Erro ao buscar perfil do cliente' });
  }
};

const sanitizeBirthday = (value) => {
  if (!value) return null;
  const trimmed = String(value).slice(0, 10);
  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const createClient = async (req, res) => {
  try {
    if (req.user?.role !== 'Gerente') {
      return res.status(403).json({ message: 'Apenas gestão pode criar clientes no cadastro.' });
    }
    const { name, phone, email, birthday, notes, tags } = req.body || {};
    if (!name || !phone) {
      return res.status(400).json({ message: 'Nome e telefone são obrigatórios' });
    }

    const tenantId = tenantIdFromReq(req);
    if (email) {
      const existing = await prisma.customer.findFirst({ where: { tenantId, email } });
      if (existing) {
        return res.status(400).json({ message: 'Este e-mail já está em uso' });
      }
    }

    const data = {
      tenantId,
      name: String(name),
      phone: String(phone),
      email: email ? String(email) : null,
      birthday: sanitizeBirthday(birthday),
      notes: notes ? String(notes) : null,
      tags: Array.isArray(tags) ? tags : parseTags(tags),
    };

    const customer = await prisma.customer.create({ data });

    const normalized = normalizePhone(customer.phone);
    if (normalized) {
      await prisma.appointment.updateMany({
        where: {
          tenantId,
          customer_id: null,
          phone: { contains: normalized.slice(-9) },
        },
        data: { customer_id: customer.id }
      });
    }

    const { password: _pw, ...publicCustomer } = customer;
    res.status(201).json(publicCustomer);
  } catch (error) {
    console.error('createClient error:', error);
    res.status(500).json({ message: 'Erro ao criar cliente' });
  }
};

const updateClient = async (req, res) => {
  try {
    if (req.user?.role !== 'Gerente') {
      return res.status(403).json({ message: 'Apenas gestão pode editar clientes cadastrados.' });
    }
    const { id } = req.params;
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) {
      return res.status(400).json({ message: 'ID inválido' });
    }

    const { name, phone, email, birthday, notes, tags } = req.body || {};

    const tenantId = tenantIdFromReq(req);
    const owned = await prisma.customer.findFirst({ where: { id: numericId, tenantId } });
    if (!owned) return res.status(404).json({ message: 'Cliente não encontrado' });

    if (email) {
      const conflict = await prisma.customer.findFirst({
        where: { tenantId, email, NOT: { id: numericId } },
      });
      if (conflict) return res.status(400).json({ message: 'Este e-mail já está em uso' });
    }

    const data = {};
    if (name !== undefined) data.name = String(name);
    if (phone !== undefined) data.phone = String(phone);
    if (email !== undefined) data.email = email ? String(email) : null;
    if (birthday !== undefined) data.birthday = sanitizeBirthday(birthday);
    if (notes !== undefined) data.notes = notes ? String(notes) : null;
    if (tags !== undefined) data.tags = Array.isArray(tags) ? tags : parseTags(tags);

    const customer = await prisma.customer.update({ where: { id: numericId }, data });
    const { password: _pw, ...publicCustomer } = customer;
    res.json(publicCustomer);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Cliente não encontrado' });
    }
    console.error('updateClient error:', error);
    res.status(500).json({ message: 'Erro ao atualizar cliente' });
  }
};

const deleteClient = async (req, res) => {
  try {
    if (req.user?.role !== 'Gerente') {
      return res.status(403).json({ message: 'Apenas gestão pode excluir clientes cadastrados.' });
    }
    const { id } = req.params;
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) {
      return res.status(400).json({ message: 'ID inválido' });
    }
    const tenantId = tenantIdFromReq(req);
    const owned = await prisma.customer.findFirst({ where: { id: numericId, tenantId } });
    if (!owned) return res.status(404).json({ message: 'Cliente não encontrado' });

    await prisma.appointment.updateMany({
      where: { tenantId, customer_id: numericId },
      data: { customer_id: null },
    });
    await prisma.customer.delete({ where: { id: numericId } });
    res.sendStatus(204);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Cliente não encontrado' });
    }
    console.error('deleteClient error:', error);
    res.status(500).json({ message: 'Erro ao excluir cliente' });
  }
};

const promoteFromAppointment = async (req, res) => {
  try {
    if (req.user?.role !== 'Gerente') {
      return res.status(403).json({ message: 'Apenas gestão pode promover clientes.' });
    }
    const { name, phone, email } = req.body || {};
    if (!name || !phone) {
      return res.status(400).json({ message: 'Nome e telefone são obrigatórios' });
    }

    const normalized = normalizePhone(phone);
    if (!normalized) {
      return res.status(400).json({ message: 'Telefone inválido' });
    }

    const tenantId = tenantIdFromReq(req);
    const existing = await prisma.customer.findFirst({ where: { tenantId, phone } });
    if (existing) {
      return res.status(409).json({ message: 'Cliente já cadastrado', customer: existing });
    }

    const customer = await prisma.customer.create({
      data: {
        tenantId,
        name: String(name),
        phone: String(phone),
        email: email ? String(email) : null,
      },
    });

    await prisma.appointment.updateMany({
      where: {
        tenantId,
        customer_id: null,
        phone: { contains: normalized.slice(-9) },
      },
      data: { customer_id: customer.id },
    });

    const { password: _pw, ...publicCustomer } = customer;
    res.status(201).json(publicCustomer);
  } catch (error) {
    console.error('promoteFromAppointment error:', error);
    res.status(500).json({ message: 'Erro ao promover cliente' });
  }
};

const exportCsv = async (req, res) => {
  try {
    const all = await buildClientsIndex({
      tenantId: tenantIdFromReq(req),
      barberIdFilter: barberIdFilterForRequest(req),
    });
    const escape = (value) => {
      if (value === null || value === undefined) return '';
      const str = String(value).replace(/"/g, '""');
      return `"${str}"`;
    };

    const header = [
      'Nome',
      'Telefone',
      'Email',
      'Aniversário',
      'Tags',
      'Status',
      'Total Gasto',
      'Visitas',
      'Última Visita',
      'Próximo Agendamento',
      'Origem'
    ];

    const lines = [header.join(',')];
    for (const c of all) {
      lines.push([
        escape(c.name),
        escape(c.phone),
        escape(c.email),
        escape(c.birthday),
        escape((c.tags || []).join('|')),
        escape(c.status),
        escape(Number(c.totalSpent || 0).toFixed(2)),
        escape(c.visitCount || 0),
        escape(c.lastVisit),
        escape(c.nextAppointment ? `${c.nextAppointment.date} ${c.nextAppointment.time}` : ''),
        escape(c.source === 'customer' ? 'Cadastrado' : 'Agendamento')
      ].join(','));
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="clientes.csv"');
    res.write('\uFEFF');
    res.end(lines.join('\n'));
  } catch (error) {
    console.error('exportCsv error:', error);
    res.status(500).json({ message: 'Erro ao exportar clientes' });
  }
};

module.exports = {
  listClients,
  getClientStats,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  promoteFromAppointment,
  exportCsv,
  buildClientsIndex,
  findClientByKey,
};
