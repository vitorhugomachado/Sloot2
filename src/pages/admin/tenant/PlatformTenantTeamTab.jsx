import React, { useCallback, useEffect, useState } from 'react';
import { UserPlus, Users } from 'lucide-react';
import { platformTenantFetch, validateStrongPassword } from '../platformAuth';
import { PlatformPanel } from '../PlatformPageShell';
import PlatformEmptyState from './PlatformEmptyState';
import PlatformEmployeePermissionsEditor, {
  EMPLOYEE_ASSIGNABLE_MODULES,
  normalizePermissionList,
} from './PlatformEmployeePermissionsEditor';

const EMPTY_CREATE = { name: '', email: '', password: '', role: 'Barbeiro' };

export default function PlatformTenantTeamTab({
  tenantId,
  tenantEnabledModules = EMPLOYEE_ASSIGNABLE_MODULES,
  onToast,
  onError,
}) {
  const [barbers, setBarbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE);
  const [profileForm, setProfileForm] = useState({ name: '', email: '', password: '', acceptsAppointments: true });
  const [saving, setSaving] = useState(false);

  const enabledForTenant = Array.isArray(tenantEnabledModules) && tenantEnabledModules.length > 0
    ? tenantEnabledModules
    : EMPLOYEE_ASSIGNABLE_MODULES;

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

  useEffect(() => {
    if (!selected) return;
    setProfileForm({
      name: selected.name || '',
      email: selected.email || '',
      password: '',
      acceptsAppointments: selected.acceptsAppointments !== false,
    });
  }, [selected]);

  const normalizeBarberPermissions = (barber) => {
    let perms = normalizePermissionList(barber.permissions);
    if (perms.includes('products') && !perms.includes('inventory') && enabledForTenant.includes('inventory')) {
      perms = [...perms.filter((p) => p !== 'products'), 'inventory'];
    }
    return perms.filter((p) => {
      if (p === 'products') return enabledForTenant.includes('inventory');
      if (p === 'users') return enabledForTenant.includes('users');
      return enabledForTenant.includes(p);
    });
  };

  const selectBarber = (barber) => {
    onError('');
    setShowForm(false);
    setSelected({
      ...barber,
      permissions: normalizeBarberPermissions(barber),
    });
  };

  const createBarber = async (e) => {
    e.preventDefault();
    setSaving(true);
    onError('');
    try {
      await platformTenantFetch(tenantId, '/barbers', {
        method: 'POST',
        body: JSON.stringify(createForm),
      });
      onToast('Profissional criado.');
      setCreateForm(EMPTY_CREATE);
      setShowForm(false);
      await load();
    } catch (err) {
      onError(err.message || 'Erro ao criar profissional.');
    } finally {
      setSaving(false);
    }
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    onError('');
    try {
      const body = {
        name: profileForm.name.trim(),
        email: profileForm.email.trim(),
        acceptsAppointments: profileForm.acceptsAppointments !== false,
      };
      if (profileForm.password.trim()) {
        const pwdErr = validateStrongPassword(profileForm.password);
        if (pwdErr) {
          onError(pwdErr);
          setSaving(false);
          return;
        }
        body.password = profileForm.password;
      }
      await platformTenantFetch(tenantId, `/barbers/${selected.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      onToast('Dados do profissional atualizados.');
      setProfileForm((prev) => ({ ...prev, password: '' }));
      await load();
    } catch (err) {
      onError(err.message || 'Erro ao salvar profissional.');
    } finally {
      setSaving(false);
    }
  };

  const savePermissions = async () => {
    if (!selected || selected.role === 'Gerente') return;
    const perms = normalizeBarberPermissions(selected);
    if (perms.length === 0) {
      onError('Selecione pelo menos um módulo para o funcionário.');
      return;
    }
    setSaving(true);
    onError('');
    try {
      await platformTenantFetch(tenantId, `/barbers/${selected.id}/permissions`, {
        method: 'PATCH',
        body: JSON.stringify({ permissions: perms }),
      });
      onToast('Permissões atualizadas.');
      await load();
    } catch (err) {
      onError(err.message || 'Erro ao salvar permissões.');
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
    if (!selected || selected.role === 'Gerente') return;
    const perms = normalizePermissionList(selected.permissions);
    const next = perms.includes(moduleId)
      ? perms.filter((p) => p !== moduleId)
      : [...perms, moduleId];
    if (next.length === 0) {
      onError('O funcionário precisa de pelo menos um módulo activo.');
      return;
    }
    onError('');
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
        <p className="platform-field-hint" style={{ marginBottom: '1rem' }}>
          Clique num funcionário para editar dados, senha e módulos de acesso.
        </p>
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
                    onClick={() => selectBarber(b)}
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
          <form className="platform-form" onSubmit={createBarber}>
            <label>
              Nome
              <input className="booking-reserve-form__field" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} required />
            </label>
            <label>
              E-mail
              <input type="email" className="booking-reserve-form__field" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} required />
            </label>
            <label>
              Senha inicial
              <input type="password" className="booking-reserve-form__field" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} placeholder="Padrão: 123" />
            </label>
            <div className="platform-modal-actions">
              <button type="button" className="dash-action-btn secondary" onClick={() => setShowForm(false)}>Cancelar</button>
              <button type="submit" className="dash-action-btn primary" disabled={saving}>{saving ? 'Salvando…' : 'Criar'}</button>
            </div>
          </form>
        </PlatformPanel>
      )}

      {selected && !showForm && (
        <PlatformPanel title={`Editar — ${selected.name}`}>
          <form className="platform-form" onSubmit={saveProfile}>
            <label>
              Nome
              <input className="booking-reserve-form__field" value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} required />
            </label>
            <label>
              E-mail
              <input type="email" className="booking-reserve-form__field" value={profileForm.email} onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} required />
            </label>
            <label>
              Nova senha (opcional)
              <input type="password" className="booking-reserve-form__field" value={profileForm.password} onChange={(e) => setProfileForm({ ...profileForm, password: e.target.value })} placeholder="Deixe vazio para manter" autoComplete="new-password" />
              <span className="platform-field-hint">Mín. 8 caracteres, maiúscula, minúscula e número.</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <input
                type="checkbox"
                checked={profileForm.acceptsAppointments !== false}
                onChange={(e) => setProfileForm({ ...profileForm, acceptsAppointments: e.target.checked })}
              />
              {selected.role === 'Gerente' ? 'Também realiza atendimentos' : 'Participa da agenda'}
            </label>
            <div className="platform-modal-actions">
              <button type="submit" className="dash-action-btn primary" disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar dados'}
              </button>
            </div>
          </form>
        </PlatformPanel>
      )}

      {selected && !showForm && selected.role !== 'Gerente' && (
        <PlatformPanel title={`Módulos — ${selected.name}`}>
          <PlatformEmployeePermissionsEditor
            employeeName={selected.name}
            permissions={normalizeBarberPermissions(selected)}
            tenantEnabledModules={enabledForTenant}
            onToggle={togglePermission}
            onSave={savePermissions}
            saving={saving}
          />
        </PlatformPanel>
      )}

      {selected?.role === 'Gerente' && !showForm && (
        <PlatformPanel title="Acesso do Gerente">
          <p className="platform-field-hint">
            O Gerente acede a todos os módulos activos da barbearia. Use os toggles em <strong>Resumo</strong> ou <strong>Módulos</strong> para limitar funcionalidades da empresa.
          </p>
        </PlatformPanel>
      )}
    </>
  );
}
