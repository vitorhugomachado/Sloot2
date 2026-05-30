const prisma = require('./prisma.js');
const { hashPassword } = require('../utils/auth');
const { publicTenantShape } = require('./tenantHelpers');
const { seedTenantDefaults } = require('./tenantDefaults');
const { DEFAULT_ENABLED_MODULES } = require('./tenantModules');
const {
  validateTenantSlug,
  validateShopName,
  validateManagerName,
  validateEmail,
  validateManagerPassword,
  normalizeSlug,
} = require('./tenantValidation');

/**
 * Cria tenant + primeiro Gerente. Usado apenas pelo painel /admin (platform).
 * @returns {{ tenant, manager }}
 */
async function createTenantWithManager(body) {
  const data = body && typeof body === 'object' ? body : {};
  const shopName = validateShopName(data.shopName || data.name);
  const slug = validateTenantSlug(data.slug || shopName);
  const managerName = validateManagerName(data.managerName || data.adminName);
  const email = validateEmail(data.email);
  const password = validateManagerPassword(data.password);

  const createDefaultServices = Boolean(data.createDefaultServices);
  const createDefaultHours = Boolean(data.createDefaultHours);

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
        enabledModules: DEFAULT_ENABLED_MODULES,
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

    await seedTenantDefaults(tx, tenant.id, {
      services: createDefaultServices,
      workingHours: createDefaultHours,
    });

    return { tenant, barber };
  });

  const { password: _pw, ...manager } = result.barber;

  return {
    tenant: publicTenantShape(result.tenant),
    manager,
  };
}

module.exports = { createTenantWithManager, normalizeSlug };
