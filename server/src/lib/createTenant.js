const prisma = require('./prisma.js');
const { hashPassword } = require('../utils/auth');
const {
  normalizeSlug,
  isValidSlug,
  isReservedSlug,
  publicTenantShape,
} = require('./tenantHelpers');

/**
 * Cria tenant + primeiro Gerente. Usado apenas pelo painel /admin (platform).
 * @returns {{ tenant, manager }}
 */
async function createTenantWithManager(body) {
  const data = body && typeof body === 'object' ? body : {};
  const shopName = String(data.shopName || data.name || '').trim();
  const slug = normalizeSlug(data.slug || shopName);
  const managerName = String(data.managerName || data.adminName || '').trim();
  const email = String(data.email || '').trim().toLowerCase();
  const password = String(data.password || '');

  if (!shopName || shopName.length < 2) {
    const err = new Error('Nome da barbearia é obrigatório.');
    err.status = 400;
    throw err;
  }
  if (!isValidSlug(slug)) {
    const err = new Error(
      'URL da barbearia inválida. Use letras minúsculas, números e hífens (ex.: minha-barbearia).',
    );
    err.status = 400;
    throw err;
  }
  if (isReservedSlug(slug)) {
    const err = new Error('Esta URL está reservada pelo sistema. Escolha outro identificador.');
    err.status = 400;
    throw err;
  }
  if (!managerName) {
    const err = new Error('Nome do responsável é obrigatório.');
    err.status = 400;
    throw err;
  }
  if (!email) {
    const err = new Error('E-mail é obrigatório.');
    err.status = 400;
    throw err;
  }
  if (password.length < 4) {
    const err = new Error('Senha deve ter pelo menos 4 caracteres.');
    err.status = 400;
    throw err;
  }

  const existingSlug = await prisma.tenant.findUnique({ where: { slug } });
  if (existingSlug) {
    const err = new Error('Esta URL já está em uso. Escolha outro identificador.');
    err.status = 409;
    throw err;
  }

  const hashedPassword = await hashPassword(password);

  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        slug,
        name: shopName,
        phone: String(data.phone || '').trim(),
        email: data.contactEmail ? String(data.contactEmail).trim() : email,
        address: String(data.address || '').trim(),
      },
    });

    const barber = await tx.barber.create({
      data: {
        tenantId: tenant.id,
        name: managerName,
        email,
        password: hashedPassword,
        role: 'Gerente',
        status: 'Ativo',
        permissions: [
          'dashboard',
          'scheduler',
          'clients',
          'finance',
          'users',
          'settings',
          'inventory',
        ],
      },
    });

    return { tenant, barber };
  });

  const { password: _pw, ...manager } = result.barber;

  return {
    tenant: publicTenantShape(result.tenant),
    manager,
  };
}

module.exports = { createTenantWithManager };
