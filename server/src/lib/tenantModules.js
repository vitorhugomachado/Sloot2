const prisma = require('./prisma.js');

const ALL_TENANT_MODULES = [
  'dashboard',
  'scheduler',
  'clients',
  'finance',
  'users',
  'inventory',
  'settings',
];

const DEFAULT_ENABLED_MODULES = [...ALL_TENANT_MODULES];

function normalizeModuleList(raw) {
  if (raw == null) return [...DEFAULT_ENABLED_MODULES];

  let list = raw;
  if (typeof raw === 'string') {
    try {
      list = JSON.parse(raw);
    } catch {
      return [...DEFAULT_ENABLED_MODULES];
    }
  }

  if (!Array.isArray(list)) return [...DEFAULT_ENABLED_MODULES];

  const valid = new Set(
    list.filter((item) => typeof item === 'string' && ALL_TENANT_MODULES.includes(item)),
  );

  return ALL_TENANT_MODULES.filter((moduleId) => valid.has(moduleId));
}

function parsePermissionList(raw) {
  if (raw == null) return [];

  let list = raw;
  if (typeof raw === 'string') {
    try {
      list = JSON.parse(raw);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(list)) return [];
  return list.filter((item) => typeof item === 'string');
}

function intersectPermissions(barberPerms, tenantModules) {
  const tenantSet = new Set(normalizeModuleList(tenantModules));
  const barberList = parsePermissionList(barberPerms);

  return barberList.filter((perm) => {
    if (tenantSet.has(perm)) return true;
    if (perm === 'products' && tenantSet.has('inventory')) return true;
    return false;
  });
}

function validateEnabledModulesPayload(raw) {
  if (!Array.isArray(raw) || raw.length === 0) {
    const err = new Error('Informe pelo menos um módulo habilitado.');
    err.status = 400;
    throw err;
  }

  const invalid = raw.filter(
    (item) => typeof item !== 'string' || !ALL_TENANT_MODULES.includes(item),
  );
  if (invalid.length > 0) {
    const err = new Error('Módulo inválido na lista.');
    err.status = 400;
    throw err;
  }

  return normalizeModuleList(raw);
}

async function assertModuleEnabled(req, moduleId) {
  if (!req.user) {
    const err = new Error('Não autenticado.');
    err.status = 401;
    throw err;
  }

  const tenantModules = normalizeModuleList(req.tenant?.enabledModules);
  if (!tenantModules.includes(moduleId)) {
    const err = new Error('Módulo não disponível para esta barbearia.');
    err.status = 403;
    throw err;
  }

  const barber = await prisma.barber.findFirst({
    where: { id: Number(req.user.id), tenantId: req.tenant.id },
    select: { permissions: true },
  });

  if (!barber) {
    const err = new Error('Acesso negado.');
    err.status = 403;
    throw err;
  }

  const effective = intersectPermissions(barber.permissions, tenantModules);
  if (!effective.includes(moduleId)) {
    const err = new Error('Sem permissão para este módulo.');
    err.status = 403;
    throw err;
  }
}

function requireTenantModule(moduleId) {
  return async (req, res, next) => {
    try {
      await assertModuleEnabled(req, moduleId);
      next();
    } catch (err) {
      res.status(err.status || 500).json({ message: err.message || 'Acesso negado.' });
    }
  };
}

module.exports = {
  ALL_TENANT_MODULES,
  DEFAULT_ENABLED_MODULES,
  normalizeModuleList,
  intersectPermissions,
  validateEnabledModulesPayload,
  assertModuleEnabled,
  requireTenantModule,
};
