import React, { useCallback, useEffect, useState } from 'react';
import { UserPlus, Users } from 'lucide-react';
import { platformTenantFetch } from '../platformAuth';
import { PlatformPanel } from '../PlatformPageShell';
import PlatformEmptyState from './PlatformEmptyState';
import { ALL_TENANT_MODULES, TENANT_MODULE_LABELS } from '../../../constants/tenantModules';

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

const EMPTY_FORM = { name: '', email: '', password: '', role: 'Barbeiro' };

export default function PlatformTenantTeamTab({ tenantId, onToast, onError }) {
  const [barbers, setBarbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await platformTenantFetch(tenantId, '/barbers');
      setBarbers(Array.isArray(data) ? data : []);
    } catch (err) {
      onError(err.message || 'Erro ao carregar equipe.');
    } finally {
      setLoading(false);
    }
  }, [tenantId, onError]);

  useEffect(() => { load(); }, [load]);

  const saveBarber = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    setSaving(true);
    onError('');
    try {
      if (selected && !showForm) {
        await platformTenantFetch(tenantId, `/barbers/${selected.id}/permissions`, {
          method: 'PATCH',
          body: JSON.stringify({ permissions: selected.permissions }),
        });
        onToast('Permissões atualizadas.');
      } else {
        await platformTenantFetch(tenantId, '/barbers', {
          method: 'POST',
          body: JSON.stringify(form),
        });
        onToast('Profissional criado.');
        setForm(EMPTY_FORM);
        setShowForm(false);
      }
      await load();
    } catch (err) {
      onError(err.message || 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (barber) => {
    const next = barber.status === 'Ativo' ? 'Suspenso' : 'Ativo';
    if (next === 'Suspenso' && !window.confirm(`Suspender ${barber.name}?`)) return;
    try {
      await platformTenantFetch(tenantId, `/barbers/${barber.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      });
      onToast(next === 'Ativo' ? 'Profissional reativado.' : 'Profissional suspenso.');
      await load();
      if (selected?.id === barber.id) setSelected({ ...barber, status: next });
    } catch (err) {
      onError(err.message || 'Erro ao alterar status.');
    }
  };

  const togglePermission = (moduleId) => {
    if (!selected) return;
    const perms = normalizePermissionList(selected.permissions);
    const next = perms.includes(moduleId)
      ? perms.filter((p) => p !== moduleId)
      : [...perms, moduleId];
    setSelected({ ...selected, permissions: next });
  };

  if (loading) return <p className="platform-loading">Carregando equipe…</p>;

  return (
    <>
      <PlatformPanel
        title={`Profissionais (${barbers.length})`}
        headerExtra={(
          <button type="button" className="dash-action-btn primary" onClick={() => { setShowForm(true); setSelected(null); }}>
            <UserPlus size={16} aria-hidden />
            Novo
          </button>
        )}
      >
        {barbers.length === 0 ? (
          <PlatformEmptyState
            icon={Users}
            title="Nenhum profissional cadastrado"
            description="Adicione profissionais para esta barbearia."
            action={(
              <button type="button" className="dash-action-btn primary" onClick={() => setShowForm(true)}>
                Adicionar primeiro profissional
              </button>
            )}
          />
        ) : (
          <div className="platform-table-wrap">
            <table className="platform-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Cargo</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {barbers.map((b) => (
                  <tr
                    key={b.id}
                    className={selected?.id === b.id ? 'platform-table-row--selected' : ''}
                    onClick={() => setSelected({ ...b, permissions: normalizePermissionList(b.permissions) })}
                  >
                    <td>{b.name}</td>
                    <td>{b.email}</td>
                    <td>{b.role}</td>
                    <td>{b.status}</td>
                    <td>
                      {b.role !== 'Gerente' ? (
                        <button
                          type="button"
                          className="platform-table-btn dash-action-btn secondary"
                          onClick={(e) => { e.stopPropagation(); toggleStatus(b); }}
                        >
                          {b.status === 'Ativo' ? 'Suspender' : 'Reativar'}
                        </button>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PlatformPanel>

      {showForm && (
        <PlatformPanel title="Novo profissional">
          <form className="platform-form" onSubmit={saveBarber}>
            <label>
              Nome
              <input className="booking-reserve-form__field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </label>
            <label>
              E-mail
              <input type="email" className="booking-reserve-form__field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </label>
            <label>
              Senha inicial
              <input type="password" className="booking-reserve-form__field" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Padrão: 123" />
            </label>
            <div className="platform-modal-actions">
              <button type="button" className="dash-action-btn secondary" onClick={() => setShowForm(false)}>Cancelar</button>
              <button type="submit" className="dash-action-btn primary" disabled={saving}>{saving ? 'Salvando…' : 'Criar'}</button>
            </div>
          </form>
        </PlatformPanel>
      )}

      {selected && !showForm && selected.role !== 'Gerente' && (
        <PlatformPanel title={`Permissões — ${selected.name}`}>
          <div className="platform-form" style={{ gap: '0.5rem' }}>
            {ALL_TENANT_MODULES.filter((m) => m !== 'users').map((moduleId) => (
              <label key={moduleId} className="platform-checkbox-label">
                <input
                  type="checkbox"
                  checked={normalizePermissionList(selected.permissions).includes(moduleId)}
                  onChange={() => togglePermission(moduleId)}
                />
                {TENANT_MODULE_LABELS[moduleId]}
              </label>
            ))}
          </div>
          <div className="platform-modal-actions" style={{ marginTop: '1rem' }}>
            <button type="button" className="dash-action-btn primary" disabled={saving} onClick={saveBarber}>
              {saving ? 'Salvando…' : 'Salvar permissões'}
            </button>
          </div>
        </PlatformPanel>
      )}
    </>
  );
}
