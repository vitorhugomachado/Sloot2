export const PLATFORM_TENANT_TABS = [
  { id: 'resumo', label: 'Resumo' },
  { id: 'equipe', label: 'Equipe' },
  { id: 'estoque', label: 'Estoque' },
  { id: 'configuracao', label: 'Configuração' },
  { id: 'modulos', label: 'Módulos' },
];

export const VALID_PLATFORM_TENANT_TABS = PLATFORM_TENANT_TABS.map((t) => t.id);

export const DEFAULT_PLATFORM_TENANT_TAB = 'resumo';

export function platformTenantTabPath(tenantId, tabId) {
  return `/admin/barbearias/${tenantId}/${tabId}`;
}
