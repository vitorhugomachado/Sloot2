export const ALL_TENANT_MODULES = [
  'dashboard',
  'scheduler',
  'clients',
  'finance',
  'users',
  'inventory',
  'settings',
];

export const TENANT_MODULE_LABELS = {
  dashboard: 'Dashboard',
  scheduler: 'Agendamentos',
  clients: 'Clientes',
  finance: 'Financeiro',
  users: 'Usuários',
  inventory: 'Estoque',
  settings: 'Configurações',
};

export const DEFAULT_ENABLED_MODULES = [...ALL_TENANT_MODULES];

export function normalizeModuleList(raw) {
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
