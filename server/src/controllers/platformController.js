const prisma = require('../lib/prisma.js');
const { comparePassword, generateToken, hashPassword } = require('../utils/auth');
const { publicTenantShape } = require('../lib/tenantHelpers');
const { createTenantWithManager } = require('../lib/createTenant');
const {
  validateTenantSlug,
  validateShopName,
  validateManagerName,
  validateEmail,
  validateManagerPassword,
} = require('../lib/tenantValidation');
const {
  normalizeModuleList,
  validateEnabledModulesPayload,
} = require('../lib/tenantModules');

const tenantSelect = {
  id: true,
  slug: true,
  name: true,
  status: true,
  email: true,
  phone: true,
  address: true,
  logo_url: true,
  banner_url: true,
  tagline: true,
  slogan: true,
  instagram_url: true,
  facebook_url: true,
  whatsapp_url: true,
  show_instagram: true,
  show_facebook: true,
  show_whatsapp: true,
  createdAt: true,
  updatedAt: true,
  enabledModules: true,
  _count: { select: { barbers: true, appointments: true, customers: true, services: true } },
};

const tenantBarberSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  acceptsAppointments: true,
};

const managerSelect = {
  id: true,
  name: true,
  email: true,
  status: true,
  role: true,
  acceptsAppointments: true,
};

async function findManager(tenantId) {
  return prisma.barber.findFirst({
    where: { tenantId, role: 'Gerente', deletedAt: null },
    select: managerSelect,
  });
}

const platformLogin = async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = req.body?.password;

  try {
    const admin = await prisma.platformAdmin.findUnique({ where: { email } });
    if (!admin || admin.status !== 'active') {
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }
    const ok = await comparePassword(password, admin.password);
    if (!ok) {
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }
    const token = generateToken({ id: admin.id, type: 'platform', role: 'platform' });
    const { password: _pw, ...data } = admin;
    res.json({ token, user: data });
  } catch (err) {
    console.error('platformLogin error:', err);
    res.status(500).json({ message: 'Erro no login da plataforma.' });
  }
};

const listTenants = async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const status = String(req.query.status || '').trim();
    const sort = String(req.query.sort || 'createdAt_desc');

    const where = {};
    if (status === 'active' || status === 'suspended') {
      where.status = status;
    }
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { slug: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }

    let orderBy = { createdAt: 'desc' };
    if (sort === 'name_asc') orderBy = { name: 'asc' };
    else if (sort === 'name_desc') orderBy = { name: 'desc' };
    else if (sort === 'createdAt_asc') orderBy = { createdAt: 'asc' };

    const tenants = await prisma.tenant.findMany({
      where,
      orderBy,
      select: tenantSelect,
    });
    res.json(tenants);
  } catch (err) {
    console.error('listTenants error:', err);
    res.status(500).json({ message: 'Erro ao listar barbearias.' });
  }
};

const getTenant = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'ID inválido.' });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      select: tenantSelect,
    });
    if (!tenant) {
      return res.status(404).json({ message: 'Barbearia não encontrada.' });
    }

    const manager = await findManager(id);
    const barbers = await prisma.barber.findMany({
      where: { tenantId: id, deletedAt: null },
      select: tenantBarberSelect,
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });

    res.json({
      ...publicTenantShape(tenant),
      phone: tenant.phone,
      address: tenant.address,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
      enabledModules: normalizeModuleList(tenant.enabledModules),
      _count: tenant._count,
      manager,
      barbers,
    });
  } catch (err) {
    console.error('getTenant error:', err);
    res.status(500).json({ message: 'Erro ao carregar barbearia.' });
  }
};

const createTenant = async (req, res) => {
  try {
    const result = await createTenantWithManager(req.body);
    res.status(201).json(result);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ message: err.message });
    }
    if (err.code === 'P2002') {
      return res.status(409).json({ message: 'E-mail ou URL já cadastrados.' });
    }
    console.error('createTenant error:', err);
    res.status(500).json({ message: 'Erro ao criar barbearia.' });
  }
};

const updateTenant = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const data = {};

    if (body.name !== undefined) {
      data.name = validateShopName(body.name);
    }
    if (body.slug !== undefined) {
      const slug = validateTenantSlug(body.slug);
      const existing = await prisma.tenant.findFirst({
        where: { slug, NOT: { id } },
      });
      if (existing) {
        return res.status(409).json({ message: 'Esta URL já está em uso. Escolha outro identificador.' });
      }
      data.slug = slug;
    }
    if (body.phone !== undefined) data.phone = String(body.phone ?? '').trim();
    if (body.email !== undefined) data.email = String(body.email ?? '').trim();
    if (body.address !== undefined) data.address = String(body.address ?? '').trim();

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: 'Nenhum campo para atualizar.' });
    }

    const tenant = await prisma.tenant.update({ where: { id }, data });
    res.json(publicTenantShape(tenant));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    if (err.code === 'P2025') return res.status(404).json({ message: 'Barbearia não encontrada.' });
    if (err.code === 'P2002') return res.status(409).json({ message: 'URL ou e-mail já cadastrados.' });
    console.error('updateTenant error:', err);
    res.status(500).json({ message: 'Erro ao atualizar barbearia.' });
  }
};

const updateTenantManager = async (req, res) => {
  try {
    const tenantId = Number(req.params.id);
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const manager = await findManager(tenantId);
    if (!manager) {
      return res.status(404).json({ message: 'Gerente não encontrado.' });
    }

    const data = {};
    if (body.name !== undefined) data.name = validateManagerName(body.name);
    if (body.email !== undefined) data.email = validateEmail(body.email);
    if (body.password !== undefined && String(body.password).trim()) {
      data.password = await hashPassword(validateManagerPassword(body.password));
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: 'Nenhum campo para atualizar.' });
    }

    const updated = await prisma.barber.update({
      where: { id: manager.id },
      data,
      select: managerSelect,
    });
    res.json(updated);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    if (err.code === 'P2002') return res.status(409).json({ message: 'E-mail já cadastrado nesta barbearia.' });
    console.error('updateTenantManager error:', err);
    res.status(500).json({ message: 'Erro ao atualizar gerente.' });
  }
};

const updateTenantStatus = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const status = String(req.body?.status || '').trim();
    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({ message: 'Status deve ser active ou suspended.' });
    }
    const tenant = await prisma.tenant.update({
      where: { id },
      data: { status },
    });
    res.json(publicTenantShape(tenant));
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Barbearia não encontrada.' });
    }
    console.error('updateTenantStatus error:', err);
    res.status(500).json({ message: 'Erro ao atualizar barbearia.' });
  }
};

const updateTenantModules = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'ID inválido.' });
    }

    const enabledModules = validateEnabledModulesPayload(req.body?.enabledModules);

    const tenant = await prisma.tenant.update({
      where: { id },
      data: { enabledModules },
      select: tenantSelect,
    });

    res.json({
      ...publicTenantShape(tenant),
      enabledModules: normalizeModuleList(tenant.enabledModules),
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    if (err.code === 'P2025') return res.status(404).json({ message: 'Barbearia não encontrada.' });
    console.error('updateTenantModules error:', err);
    res.status(500).json({ message: 'Erro ao atualizar módulos.' });
  }
};

const getPlatformStats = async (req, res) => {
  try {
    const now = new Date();
    const last7 = new Date(now);
    last7.setDate(last7.getDate() - 7);
    const last30 = new Date(now);
    last30.setDate(last30.getDate() - 30);

    const [
      activeTenants,
      suspendedTenants,
      newLast7Days,
      newLast30Days,
      totalAppointments,
      allTenants,
    ] = await Promise.all([
      prisma.tenant.count({ where: { status: 'active' } }),
      prisma.tenant.count({ where: { status: 'suspended' } }),
      prisma.tenant.count({ where: { createdAt: { gte: last7 } } }),
      prisma.tenant.count({ where: { createdAt: { gte: last30 } } }),
      prisma.appointment.count(),
      prisma.tenant.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          _count: { select: { appointments: true } },
        },
      }),
    ]);

    const topTenants = allTenants
      .sort((a, b) => b._count.appointments - a._count.appointments)
      .slice(0, 5)
      .map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        status: t.status,
        appointments: t._count.appointments,
      }));

    res.json({
      tenants: {
        active: activeTenants,
        suspended: suspendedTenants,
        total: activeTenants + suspendedTenants,
        newLast7Days,
        newLast30Days,
      },
      appointments: { total: totalAppointments },
      topTenants,
    });
  } catch (err) {
    console.error('getPlatformStats error:', err);
    res.status(500).json({ message: 'Erro ao carregar estatísticas.' });
  }
};

const listPlatformAdmins = async (req, res) => {
  try {
    const admins = await prisma.platformAdmin.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        createdAt: true,
      },
    });
    res.json(admins);
  } catch (err) {
    console.error('listPlatformAdmins error:', err);
    res.status(500).json({ message: 'Erro ao listar administradores.' });
  }
};

const createPlatformAdmin = async (req, res) => {
  try {
    const name = validateManagerName(req.body?.name);
    const email = validateEmail(req.body?.email);
    const password = validateManagerPassword(req.body?.password);
    const hashed = await hashPassword(password);

    const admin = await prisma.platformAdmin.create({
      data: { name, email, password: hashed, status: 'active' },
      select: { id: true, name: true, email: true, status: true, createdAt: true },
    });
    res.status(201).json(admin);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    if (err.code === 'P2002') return res.status(409).json({ message: 'E-mail já cadastrado.' });
    console.error('createPlatformAdmin error:', err);
    res.status(500).json({ message: 'Erro ao criar administrador.' });
  }
};

const updatePlatformAdmin = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const data = {};

    if (body.name !== undefined) data.name = validateManagerName(body.name);
    if (body.email !== undefined) data.email = validateEmail(body.email);
    if (body.password !== undefined && String(body.password).trim()) {
      data.password = await hashPassword(validateManagerPassword(body.password));
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: 'Nenhum campo para atualizar.' });
    }

    const admin = await prisma.platformAdmin.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, status: true, createdAt: true },
    });
    res.json(admin);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    if (err.code === 'P2025') return res.status(404).json({ message: 'Administrador não encontrado.' });
    if (err.code === 'P2002') return res.status(409).json({ message: 'E-mail já cadastrado.' });
    console.error('updatePlatformAdmin error:', err);
    res.status(500).json({ message: 'Erro ao atualizar administrador.' });
  }
};

const updatePlatformAdminStatus = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const status = String(req.body?.status || '').trim();
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ message: 'Status deve ser active ou inactive.' });
    }
    if (req.user?.id === id && status === 'inactive') {
      return res.status(400).json({ message: 'Não pode desativar a sua própria conta.' });
    }

    const admin = await prisma.platformAdmin.update({
      where: { id },
      data: { status },
      select: { id: true, name: true, email: true, status: true, createdAt: true },
    });
    res.json(admin);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Administrador não encontrado.' });
    console.error('updatePlatformAdminStatus error:', err);
    res.status(500).json({ message: 'Erro ao atualizar administrador.' });
  }
};

module.exports = {
  platformLogin,
  listTenants,
  getTenant,
  createTenant,
  updateTenant,
  updateTenantManager,
  updateTenantStatus,
  updateTenantModules,
  getPlatformStats,
  listPlatformAdmins,
  createPlatformAdmin,
  updatePlatformAdmin,
  updatePlatformAdminStatus,
};
