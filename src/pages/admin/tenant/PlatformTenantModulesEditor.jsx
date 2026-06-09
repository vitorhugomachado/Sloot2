import React from 'react';
import { ALL_TENANT_MODULES, TENANT_MODULE_LABELS } from '../../../constants/tenantModules';

export default function PlatformTenantModulesEditor({
  enabledModules,
  onToggle,
  onSave,
  saving = false,
  hint = 'Módulos desligados deixam de aparecer para toda a equipa. As alterações aplicam-se no próximo reload ou login da equipa.',
}) {
  return (
    <>
      {hint ? <p className="platform-field-hint" style={{ marginBottom: '1rem' }}>{hint}</p> : null}
      <div className="platform-module-toggles" role="group" aria-label="Módulos da barbearia">
        {ALL_TENANT_MODULES.map((moduleId) => {
          const active = enabledModules.includes(moduleId);
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
          {saving ? 'Salvando…' : 'Salvar módulos'}
        </button>
      </div>
    </>
  );
}
