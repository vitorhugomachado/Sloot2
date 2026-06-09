import React from 'react';
import { TENANT_MODULE_LABELS } from '../../../constants/tenantModules';

function normalizePermissionList(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.filter((x) => typeof x === 'string');
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Módulos que podem ser atribuídos a barbeiros (equipa gerida pelo Gerente). */
export const EMPLOYEE_ASSIGNABLE_MODULES = [
  'dashboard',
  'scheduler',
  'clients',
  'finance',
  'inventory',
  'settings',
];

export default function PlatformEmployeePermissionsEditor({
  employeeName,
  permissions,
  tenantEnabledModules,
  onToggle,
  onSave,
  saving = false,
}) {
  const enabledSet = new Set(
    Array.isArray(tenantEnabledModules) && tenantEnabledModules.length > 0
      ? tenantEnabledModules
      : EMPLOYEE_ASSIGNABLE_MODULES,
  );
  const assignable = EMPLOYEE_ASSIGNABLE_MODULES.filter((id) => enabledSet.has(id));
  const current = normalizePermissionList(permissions);

  return (
    <>
      <p className="platform-field-hint" style={{ marginBottom: '1rem' }}>
        Defina o que <strong>{employeeName}</strong> pode aceder no painel da equipa.
        Só aparecem módulos habilitados para esta barbearia.
      </p>
      <div className="platform-module-toggles" role="group" aria-label={`Permissões de ${employeeName}`}>
        {assignable.map((moduleId) => {
          const active = current.includes(moduleId);
          return (
            <button
              key={moduleId}
              type="button"
              className={`platform-module-toggle${active ? ' active' : ''}`}
              aria-pressed={active}
              onClick={() => onToggle(moduleId)}
            >
              {TENANT_MODULE_LABELS[moduleId] || moduleId}
            </button>
          );
        })}
      </div>
      <div className="platform-modal-actions" style={{ marginTop: '1rem' }}>
        <button type="button" className="dash-action-btn primary" disabled={saving} onClick={onSave}>
          {saving ? 'Salvando…' : 'Salvar permissões'}
        </button>
      </div>
    </>
  );
}

export { normalizePermissionList };
