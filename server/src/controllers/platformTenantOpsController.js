const prisma = require('../lib/prisma.js');
const { hashPassword } = require('../utils/auth');
const { publicTenantShape } = require('../lib/tenantHelpers');
const { tenantIdFromPlatformReq, tenantWhereFromPlatformReq } = require('../lib/platformTenantReq');
const { normalizeModuleList, intersectPermissions } = require('../lib/tenantModules');
const { invalidatePublicCache } = require('../middlewares/publicCache');
const { parseStaffDateRangeFromQuery } = require('../lib/bookingHorizon');
const { buildClientsIndex, findClientByKey } = require('../controllers/clientController');

const includeBarber = { Barber: { select: { name: true } } };

const BARBER_WRITABLE_KEYS = [
  'name', 'email', 'role', 'status', 'foto_perfil', 'whatsapp', 'bio',
  'commission', 'chave_pix', 'data_admissao', 'permissions', 'specialties',
  'acceptsAppointments',
];

function pickBarberScalars(body) {
  const out = {};
  for (const key of BARBER_WRITABLE_KEYS) {
    if (body[key] === undefined) continue;
    out[key] = body[key];
  }
  if (typeof out.email === 'string') out.email = out.email.trim();
  if (out.commission !== undefined && out.commission !== null && out.commission !== '') {
    const n = Number(out.commission);
    if (Number.isFinite(n)) out.commission = n;
    else delete out.commission;
  } else {
    delete out.commission;
  }
  if (out.permissions != null && !Array.isArray(out.permissions)) delete out.permissions;
  if (out.specialties != null && !Array.isArray(out.specialties)) delete out.specialties;
  if (out.foto_perfil === '') delete out.foto_perfil;
  return out;
}

function normalizeShiftsForCreate(shiftsRaw) {
  if (!Array.isArray(shiftsRaw) || shiftsRaw.length === 0) return [];
  const mapped = shiftsRaw
    .map((s) => ({
      dia_semana: Number(s.dia_semana),
      hora_inicio: String(s.hora_inicio ?? '09:00'),
      hora_fim: String(s.hora_fim ?? '18:00'),
      almoco_inicio: String(s.almoco_inicio ?? '12:00'),
      almoco_fim: String(s.almoco_fim ?? '13:00'),
      ativo: s.ativo !== false && s.ativo !== 'false',
    }))
    .filter((s) => Number.isInteger(s.dia_semana) && s.dia_semana >= 0 && s.dia_semana <= 6);
  const seen = new Set();
  return mapped.filter((s) => {
    const k = `${s.dia_semana}|${s.hora_inicio}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const barberSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  permissions: true,
  foto_perfil: true,
  shifts: true,
  whatsapp: true,
  commission: true,
  acceptsAppointments: true,
};

function nullableString(v) {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function buildBusinessUpdatePayload(body) {
  const b = body && typeof body === 'object' ? body : {};
  const data = {};
  if (b.name !== undefined) data.name = String(b.name ?? '').trim() || undefined;
  if (b.phone !== undefined) data.phone = String(b.phone ?? '').trim();
  if (b.email !== undefined) data.email = String(b.email ?? '').trim();
  if (b.address !== undefined) data.address = String(b.address ?? '').trim();
  if (b.logo_url !== undefined) data.logo_url = nullableString(b.logo_url);
  if (b.banner_url !== undefined) data.banner_url = nullableString(b.banner_url);
  if (b.tagline !== undefined) data.tagline = String(b.tagline ?? '').trim();
  if (b.slogan !== undefined) data.slogan = String(b.slogan ?? '').trim();
  if (b.instagram_url !== undefined) data.instagram_url = nullableString(b.instagram_url);
  if (b.facebook_url !== undefined) data.facebook_url = nullableString(b.facebook_url);
  if (b.whatsapp_url !== undefined) data.whatsapp_url = nullableString(b.whatsapp_url);
  if (b.show_instagram !== undefined) data.show_instagram = Boolean(b.show_instagram);
  if (b.show_facebook !== undefined) data.show_facebook = Boolean(b.show_facebook);
  if (b.show_whatsapp !== undefined) data.show_whatsapp = Boolean(b.show_whatsapp);
  Object.keys(data).forEach((k) => { if (data[k] === undefined) delete data[k]; });
  return data;
}

function sanitizeBirthday(value) {
  if (!value) return null;
  const trimmed = String(value).slice(0, 10);
  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function parseTags(raw) {
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
}

async function findBarberInTenant(req, barberId) {
  return prisma.barber.findFirst({
    where: { id: Number(barberId), ...tenantWhereFromPlatformReq(req), deletedAt: null },
  });
}

// --- Barbers ---

const listBarbers = async (req, res) => {
  try {
    const barbers = await prisma.barber.findMany({
      where: { ...tenantWhereFromPlatformReq(req), deletedAt: null },
      select: barberSelect,
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });
    res.json(barbers);
  } catch (err) {
    console.error('platform listBarbers:', err);
    res.status(500).json({ message: 'Erro ao listar profissionais.' });
  }
};

const createBarber = async (req, res) => {
  try {
    const tenantId = tenantIdFromPlatformReq(req);
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const { password, shifts: shiftsRaw } = body;
    const data = pickBarberScalars(body);

    if (!data.email) {
      return res.status(400).json({ message: 'E-mail é obrigatório.' });
    }

    const existingBarber = await prisma.barber.findUnique({
      where: { tenantId_email: { tenantId, email: data.email.toLowerCase() } },
    });
    if (existingBarber) {
      if (existingBarber.deletedAt) {
        await prisma.barber.update({
          where: { id: existingBarber.id },
          data: { email: `${existingBarber.email}_deleted_legacy_${Date.now()}` },
        });
      } else {
        return res.status(400).json({ message: 'E-mail já cadastrado.' });
      }
    }

    const shifts = normalizeShiftsForCreate(shiftsRaw);
    const hashedPassword = await hashPassword(password || '123');
    if (data.permissions == null) data.permissions = ['scheduler', 'clients'];
    if (!data.role) data.role = 'Barbeiro';
    if (!data.status) data.status = 'Ativo';

    const barber = await prisma.barber.create({
      data: {
        ...data,
        tenantId,
        password: hashedPassword,
        shifts: shifts.length > 0
          ? {
              create: shifts.map((s) => ({
                dia_semana: s.dia_semana,
                hora_inicio: s.hora_inicio,
                hora_fim: s.hora_fim,
                almoco_inicio: s.almoco_inicio,
                almoco_fim: s.almoco_fim,
                ativo: s.ativo,
              })),
            }
          : undefined,
      },
      include: { shifts: true },
    });

    invalidatePublicCache(req.tenantSlug);
    const { password: _pw, ...barberData } = barber;
    res.status(201).json(barberData);
  } catch (err) {
    console.error('platform createBarber:', err);
    if (err.code === 'P2002') return res.status(400).json({ message: 'E-mail já cadastrado.' });
    res.status(500).json({ message: 'Erro ao criar profissional.' });
  }
};

const updateBarber = async (req, res) => {
  try {
    const barberId = Number(req.params.barberId);
    const existing = await findBarberInTenant(req, barberId);
    if (!existing) return res.status(404).json({ message: 'Profissional não encontrado.' });

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const { password, shifts: shiftsRaw } = body;
    const data = pickBarberScalars(body);

    if (password !== undefined && String(password).trim()) {
      data.password = await hashPassword(String(password).trim());
    }
    Object.keys(data).forEach((k) => { if (data[k] === undefined) delete data[k]; });

    const barber = await prisma.$transaction(async (tx) => {
      if (shiftsRaw !== undefined) {
        const shifts = normalizeShiftsForCreate(shiftsRaw);
        await tx.workingShifts.deleteMany({ where: { id_barbeiro: barberId } });
        if (shifts.length > 0) {
          await tx.workingShifts.createMany({
            data: shifts.map((s) => ({ id_barbeiro: barberId, ...s })),
          });
        }
      }
      if (Object.keys(data).length === 0) {
        return tx.barber.findUniqueOrThrow({ where: { id: barberId }, include: { shifts: true } });
      }
      return tx.barber.update({ where: { id: barberId }, data, include: { shifts: true } });
    });

    invalidatePublicCache(req.tenantSlug);
    const { password: _pw, ...barberData } = barber;
    res.json(barberData);
  } catch (err) {
    console.error('platform updateBarber:', err);
    res.status(500).json({ message: 'Erro ao atualizar profissional.' });
  }
};

const updateBarberPermissions = async (req, res) => {
  try {
    const barberId = Number(req.params.barberId);
    const existing = await findBarberInTenant(req, barberId);
    if (!existing) return res.status(404).json({ message: 'Profissional não encontrado.' });
    if (existing.role === 'Gerente') {
      return res.status(400).json({ message: 'Permissões do Gerente não podem ser alteradas aqui.' });
    }

    const permissions = req.body?.permissions;
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ message: 'permissions deve ser um array.' });
    }

    const tenantModules = normalizeModuleList(req.tenant?.enabledModules);
    const sanitized = intersectPermissions(permissions, tenantModules);
    if (sanitized.length === 0) {
      return res.status(400).json({ message: 'Selecione pelo menos um módulo válido para o funcionário.' });
    }

    const barber = await prisma.barber.update({
      where: { id: barberId },
      data: { permissions: sanitized },
      select: barberSelect,
    });
    res.json(barber);
  } catch (err) {
    console.error('platform updateBarberPermissions:', err);
    res.status(500).json({ message: 'Erro ao atualizar permissões.' });
  }
};

// --- Services ---

const listServices = async (req, res) => {
  try {
    const services = await prisma.service.findMany({ where: tenantWhereFromPlatformReq(req) });
    res.json(services);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao listar serviços.' });
  }
};

const createService = async (req, res) => {
  try {
    const service = await prisma.service.create({
      data: { ...req.body, tenantId: tenantIdFromPlatformReq(req) },
    });
    invalidatePublicCache(req.tenantSlug);
    res.status(201).json(service);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao criar serviço.' });
  }
};

const updateService = async (req, res) => {
  try {
    const id = Number(req.params.serviceId);
    const existing = await prisma.service.findFirst({
      where: { id, ...tenantWhereFromPlatformReq(req) },
    });
    if (!existing) return res.status(404).json({ message: 'Serviço não encontrado.' });
    const service = await prisma.service.update({ where: { id }, data: req.body });
    invalidatePublicCache(req.tenantSlug);
    res.json(service);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao atualizar serviço.' });
  }
};

const deleteService = async (req, res) => {
  try {
    const id = Number(req.params.serviceId);
    const existing = await prisma.service.findFirst({
      where: { id, ...tenantWhereFromPlatformReq(req) },
    });
    if (!existing) return res.status(404).json({ message: 'Serviço não encontrado.' });
    await prisma.service.delete({ where: { id } });
    invalidatePublicCache(req.tenantSlug);
    res.sendStatus(204);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao excluir serviço.' });
  }
};

// --- Business ---

const getBusiness = async (req, res) => {
  res.json(publicTenantShape(req.tenant));
};

const patchBusiness = async (req, res) => {
  try {
    const data = buildBusinessUpdatePayload(req.body);
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: 'Nenhum campo para atualizar.' });
    }
    const tenant = await prisma.tenant.update({
      where: { id: tenantIdFromPlatformReq(req) },
      data,
    });
    invalidatePublicCache(req.tenantSlug);
    res.json(publicTenantShape(tenant));
  } catch (err) {
    res.status(500).json({ message: 'Erro ao atualizar dados do negócio.' });
  }
};

// --- Appointments ---

const listAppointments = async (req, res) => {
  try {
    const { from, to } = parseStaffDateRangeFromQuery(req.query);
    const appointments = await prisma.appointment.findMany({
      where: { ...tenantWhereFromPlatformReq(req), date: { gte: from, lte: to } },
      include: includeBarber,
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
    });
    res.json(appointments);
  } catch (err) {
    console.error('platform listAppointments:', err);
    res.status(500).json({ message: 'Erro ao listar agendamentos.' });
  }
};

const patchAppointment = async (req, res) => {
  try {
    const id = Number(req.params.appointmentId);
    const existing = await prisma.appointment.findFirst({
      where: { id, ...tenantWhereFromPlatformReq(req) },
    });
    if (!existing) return res.status(404).json({ message: 'Agendamento não encontrado.' });

    const data = { ...req.body };
    delete data.id;
    delete data.barber;
    delete data.Barber;
    if (data.customerId !== undefined) {
      data.customer_id = data.customerId ? Number(data.customerId) : null;
      delete data.customerId;
    }
    if (data.barberId) data.barberId = Number(data.barberId);
    if (data.price) data.price = parseFloat(data.price);

    const appointment = await prisma.appointment.update({
      where: { id },
      data,
      include: includeBarber,
    });
    invalidatePublicCache(req.tenantSlug);
    res.json(appointment);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao atualizar agendamento.' });
  }
};

// --- Clients ---

const listClients = async (req, res) => {
  try {
    const search = (req.query.search || '').toString().trim().toLowerCase();
    const status = (req.query.status || '').toString().trim();
    const page = Math.max(1, parseInt(req.query.page || '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || '10', 10) || 10));

    const all = await buildClientsIndex({
      tenantId: tenantIdFromPlatformReq(req),
      barberIdFilter: null,
    });

    const filtered = all.filter((c) => {
      if (status && status !== 'todos' && c.status !== status) return false;
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
      meta: { total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    });
  } catch (err) {
    console.error('platform listClients:', err);
    res.status(500).json({ message: 'Erro ao listar clientes.' });
  }
};

const getClient = async (req, res) => {
  try {
    const { clientId } = req.params;
    const guestKey = req.query.guestKey ? String(req.query.guestKey) : null;
    const tenantId = tenantIdFromPlatformReq(req);
    const client = await findClientByKey(tenantId, clientId, guestKey, null);

    if (!client) return res.status(404).json({ message: 'Cliente não encontrado.' });

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

    const enriched = await prisma.appointment.findMany({
      where: { tenantId, OR: orParts },
      include: includeBarber,
      orderBy: [{ date: 'desc' }, { time: 'desc' }],
    });

    const { appointments, ...rest } = client;
    res.json({ ...rest, history: enriched });
  } catch (err) {
    console.error('platform getClient:', err);
    res.status(500).json({ message: 'Erro ao buscar cliente.' });
  }
};

const patchClient = async (req, res) => {
  try {
    const numericId = Number(req.params.clientId);
    if (!Number.isFinite(numericId)) {
      return res.status(400).json({ message: 'ID inválido.' });
    }

    const tenantId = tenantIdFromPlatformReq(req);
    const owned = await prisma.customer.findFirst({ where: { id: numericId, tenantId } });
    if (!owned) return res.status(404).json({ message: 'Cliente não encontrado.' });

    const { name, phone, email, birthday, notes, tags } = req.body || {};
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
  } catch (err) {
    res.status(500).json({ message: 'Erro ao atualizar cliente.' });
  }
};

// --- Expenses ---

const listExpenses = async (req, res) => {
  try {
    const expenses = await prisma.expense.findMany({
      where: tenantWhereFromPlatformReq(req),
      orderBy: { date: 'desc' },
    });
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar despesas.' });
  }
};

const createExpense = async (req, res) => {
  try {
    const { description, amount, date, category } = req.body;
    const expense = await prisma.expense.create({
      data: {
        tenantId: tenantIdFromPlatformReq(req),
        description,
        amount: parseFloat(amount),
        date,
        category: category || 'Outros',
      },
    });
    res.status(201).json(expense);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar despesa.' });
  }
};

const updateExpense = async (req, res) => {
  try {
    const id = parseInt(req.params.expenseId, 10);
    const existing = await prisma.expense.findFirst({
      where: { id, ...tenantWhereFromPlatformReq(req) },
    });
    if (!existing) return res.status(404).json({ error: 'Despesa não encontrada.' });
    const updated = await prisma.expense.update({
      where: { id },
      data: {
        description: req.body.description,
        amount: parseFloat(req.body.amount),
        date: req.body.date,
        category: req.body.category,
      },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar despesa.' });
  }
};

const deleteExpense = async (req, res) => {
  try {
    const id = parseInt(req.params.expenseId, 10);
    const existing = await prisma.expense.findFirst({
      where: { id, ...tenantWhereFromPlatformReq(req) },
    });
    if (!existing) return res.status(404).json({ error: 'Despesa não encontrada.' });
    await prisma.expense.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao excluir despesa.' });
  }
};

// --- Month closings ---

const YEAR_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function getLocalDateStr(d) {
  const dt = new Date(d);
  dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
  return dt.toISOString().split('T')[0];
}

function monthBounds(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number);
  const startD = new Date(y, m - 1, 1);
  const endD = new Date(y, m, 0);
  return { startDate: getLocalDateStr(startD), endDate: getLocalDateStr(endD) };
}

async function buildSnapshotForMonth(tenantId, yearMonth) {
  const { indexBarbersById, buildCommissionReport } = require('../utils/commission.cjs');
  const { startDate, endDate } = monthBounds(yearMonth);

  const [barbers, appointments, sales, periodExpenses] = await Promise.all([
    prisma.barber.findMany({ where: { tenantId, deletedAt: null } }),
    prisma.appointment.findMany({
      where: { tenantId, status: 'Finalizado', date: { gte: startDate, lte: endDate } },
    }),
    prisma.productSale.findMany({
      where: { tenantId, date: { gte: startDate, lte: endDate } },
    }),
    prisma.expense.findMany({
      where: { tenantId, date: { gte: startDate, lte: endDate } },
    }),
  ]);

  const serviceRevenue = appointments.reduce((s, a) => s + Number(a.price || 0), 0);
  const productRevenue = sales.reduce((s, x) => s + Number(x.price || 0) * Number(x.quantity || 0), 0);
  const productCost = sales.reduce((s, x) => s + Number(x.cost || 0) * Number(x.quantity || 0), 0);
  const expenses = periodExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const revenue = serviceRevenue + productRevenue;
  const barbersById = indexBarbersById(barbers);
  const commissionReport = buildCommissionReport(appointments, barbersById, { aggregateByBarber: false });
  const netProfit = revenue - commissionReport.totals.totalBarber - expenses - productCost;
  const itemsCount = appointments.length + sales.length;

  return {
    startDate, endDate, revenue, serviceRevenue, productRevenue, productCost, expenses,
    repasseServicos: commissionReport.totals.totalBarber,
    retencaoCasaServicos: commissionReport.totals.totalHouse,
    netProfit,
    netMargin: revenue > 0 ? (netProfit / revenue) * 100 : 0,
    averageTicket: itemsCount > 0 ? revenue / itemsCount : 0,
    appointmentCount: appointments.length,
    saleCount: sales.length,
    expenseCount: periodExpenses.length,
  };
}

const listMonthClosings = async (req, res) => {
  try {
    const rows = await prisma.monthClosing.findMany({
      where: tenantWhereFromPlatformReq(req),
      orderBy: { yearMonth: 'desc' },
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar fechamentos.' });
  }
};

const createMonthClosing = async (req, res) => {
  const { yearMonth, notes } = req.body || {};
  if (!yearMonth || typeof yearMonth !== 'string' || !YEAR_MONTH_RE.test(yearMonth.trim())) {
    return res.status(400).json({ error: 'Informe yearMonth no formato YYYY-MM.' });
  }

  try {
    const tenantId = tenantIdFromPlatformReq(req);
    const ym = yearMonth.trim();
    const snapshot = await buildSnapshotForMonth(tenantId, ym);
    const created = await prisma.monthClosing.create({
      data: {
        tenantId,
        yearMonth: ym,
        closedById: null,
        closedByName: 'Admin plataforma',
        snapshot,
        notes: notes && String(notes).trim() ? String(notes).trim().slice(0, 2000) : null,
      },
    });
    res.status(201).json(created);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Este mês já possui fechamento registrado.' });
    }
    res.status(500).json({ error: 'Erro ao registrar fechamento.' });
  }
};

// --- Products & Sales ---

const listProducts = async (req, res) => {
  try {
    const products = await prisma.product.findMany({ where: tenantWhereFromPlatformReq(req) });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao listar produtos.' });
  }
};

const createProduct = async (req, res) => {
  try {
    const product = await prisma.product.create({
      data: { ...req.body, tenantId: tenantIdFromPlatformReq(req) },
    });
    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao criar produto.' });
  }
};

const updateProduct = async (req, res) => {
  try {
    const id = Number(req.params.productId);
    const existing = await prisma.product.findFirst({
      where: { id, ...tenantWhereFromPlatformReq(req) },
    });
    if (!existing) return res.status(404).json({ message: 'Produto não encontrado.' });
    const product = await prisma.product.update({ where: { id }, data: req.body });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao atualizar produto.' });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const id = Number(req.params.productId);
    const existing = await prisma.product.findFirst({
      where: { id, ...tenantWhereFromPlatformReq(req) },
    });
    if (!existing) return res.status(404).json({ message: 'Produto não encontrado.' });
    await prisma.product.delete({ where: { id } });
    res.sendStatus(204);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao excluir produto.' });
  }
};

const adjustProductStock = async (req, res) => {
  try {
    const id = Number(req.params.productId);
    const delta = Number(req.body?.delta);
    if (!Number.isInteger(delta) || delta <= 0) {
      return res.status(400).json({ message: 'Informe delta: inteiro maior que zero.' });
    }
    const existing = await prisma.product.findFirst({
      where: { id, ...tenantWhereFromPlatformReq(req) },
    });
    if (!existing) return res.status(404).json({ message: 'Produto não encontrado.' });
    const product = await prisma.product.update({
      where: { id },
      data: { stock: { increment: delta } },
    });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao actualizar estoque.' });
  }
};

const listSales = async (req, res) => {
  try {
    const sales = await prisma.productSale.findMany({
      where: tenantWhereFromPlatformReq(req),
      include: {
        Barber: { select: { id: true, name: true } },
        Customer: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
      take: 100,
    });
    res.json(sales);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao listar vendas.' });
  }
};

const createSale = async (req, res) => {
  try {
    const tenantId = tenantIdFromPlatformReq(req);
    const { barberId, customerId, customerName, ...rest } = req.body;

    let resolvedCustomerId = null;
    let resolvedCustomerName = typeof customerName === 'string' && customerName.trim()
      ? customerName.trim()
      : null;

    if (customerId != null && customerId !== '') {
      const cid = Number(customerId);
      const customer = await prisma.customer.findFirst({
        where: { id: cid, tenantId },
        select: { id: true, name: true },
      });
      if (!customer) return res.status(400).json({ message: 'Cliente não encontrado.' });
      resolvedCustomerId = customer.id;
      if (!resolvedCustomerName) resolvedCustomerName = customer.name;
    }

    const sale = await prisma.productSale.create({
      data: {
        ...rest,
        tenantId,
        barberId: barberId ? Number(barberId) : null,
        customerId: resolvedCustomerId,
        customerName: resolvedCustomerName,
      },
      include: {
        Barber: { select: { id: true, name: true } },
        Customer: { select: { id: true, name: true } },
      },
    });
    res.status(201).json(sale);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao registrar venda.' });
  }
};

module.exports = {
  listBarbers,
  createBarber,
  updateBarber,
  updateBarberPermissions,
  listServices,
  createService,
  updateService,
  deleteService,
  getBusiness,
  patchBusiness,
  listAppointments,
  patchAppointment,
  listClients,
  getClient,
  patchClient,
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  listMonthClosings,
  createMonthClosing,
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  adjustProductStock,
  listSales,
  createSale,
};
