const prisma = require('../lib/prisma.js');
const { comparePassword, generateToken } = require('../utils/auth');
const { publicTenantShape } = require('../lib/tenantHelpers');
const { createTenantWithManager } = require('../lib/createTenant');

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
    const tenants = await prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        email: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { barbers: true, appointments: true } },
      },
    });
    res.json(tenants);
  } catch (err) {
    console.error('listTenants error:', err);
    res.status(500).json({ message: 'Erro ao listar barbearias.' });
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

module.exports = {
  platformLogin,
  listTenants,
  createTenant,
  updateTenantStatus,
};
