import { ALL_TENANT_MODULES, DEFAULT_ENABLED_MODULES } from '../constants/tenantModules';

function normalizePermissions(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.filter((item) => typeof item === 'string');
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function resolveEnabledTenantModules(tenantModules) {
  return Array.isArray(tenantModules) && tenantModules.length > 0
    ? tenantModules
    : DEFAULT_ENABLED_MODULES;
}

export function isStaffNavModuleVisible(moduleId, permissions, tenantModules) {
  const enabledModules = new Set(resolveEnabledTenantModules(tenantModules));
  if (!enabledModules.has(moduleId)) return false;

  const perms = normalizePermissions(permissions);
  if (perms.includes(moduleId)) return true;
  if (moduleId === 'inventory' && perms.includes('products')) return true;
  return false;
}

export function filterStaffNavModules(moduleIds, permissions, tenantModules) {
  return moduleIds.filter((moduleId) =>
    isStaffNavModuleVisible(moduleId, permissions, tenantModules),
  );
}

export const STAFF_NAV_MODULES = [...ALL_TENANT_MODULES];
