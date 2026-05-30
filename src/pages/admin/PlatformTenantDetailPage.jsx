import React, { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, useNavigate, useParams, useLocation, Navigate } from 'react-router-dom';
import { ArrowLeft, Copy, ExternalLink, Eye, EyeOff, Mail, MapPin, Phone } from 'lucide-react';
import {
  platformFetch,
  resolvePlatformTenantId,
  slugify,
  tenantPublicUrls,
  validateStrongPassword,
} from './platformAuth';
import PlatformLayout from './PlatformLayout';
import PlatformPageShell, { PlatformKpiCard, PlatformPanel } from './PlatformPageShell';
import PlatformStatusBadge from './PlatformStatusBadge';
import PlatformToast from './PlatformToast';
import { copyWithToast } from './platformCopy';
import { ALL_TENANT_MODULES, TENANT_MODULE_LABELS } from '../../constants/tenantModules';
import {
  PLATFORM_TENANT_TABS,
  VALID_PLATFORM_TENANT_TABS,
  DEFAULT_PLATFORM_TENANT_TAB,
  platformTenantTabPath,
} from './tenant/platformTenantTabs';
import PlatformTenantTeamTab from './tenant/PlatformTenantTeamTab';
import PlatformTenantSettingsTab from './tenant/PlatformTenantSettingsTab';
import PlatformTenantInventoryTab from './tenant/PlatformTenantInventoryTab';

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('pt-BR');
  } catch {
    return '—';
  }
}

function InfoRow({ label, value, icon }) {
  if (!value) return null;
  return (
    <div className="platform-info-row">
      {icon ? <span className="platform-info-row__icon" aria-hidden>{icon}</span> : null}
      <div>
        <span className="platform-info-row__label">{label}</span>
        <span className="platform-info-row__value">{value}</span>
      </div>
    </div>
  );
}

export default function PlatformTenantDetailPage({ onLogout }) {
  const params = useParams();
  const location = useLocation();
  const tenantId = resolvePlatformTenantId(params, location.pathname);
  const activeTab = params.tab || DEFAULT_PLATFORM_TENANT_TAB;
  const navigate = useNavigate();
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [tenantForm, setTenantForm] = useState({});
  const [managerForm, setManagerForm] = useState({});
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [savingTenant, setSavingTenant] = useState(false);
  const [savingManager, setSavingManager] = useState(false);
  const [enabledModules, setEnabledModules] = useState([...ALL_TENANT_MODULES]);
  const [savingModules, setSavingModules] = useState(false);

  const setTabError = useCallback((msg) => setError(msg), []);
  const setTabToast = useCallback((msg) => setToast(msg), []);

  const loadTenant = useCallback(async () => {
    if (!tenantId) {
      setError('ID da barbearia inválido.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = await platformFetch(`/tenants/${tenantId}`);
      setTenant(data);
      setTenantForm({
        name: data.name || '',
        slug: data.slug || '',
        phone: data.phone || '',
        email: data.email || '',
        address: data.address || '',
      });
      setManagerForm({
        name: data.manager?.name || '',
        email: data.manager?.email || '',
      });
      setEnabledModules(
        Array.isArray(data.enabledModules) && data.enabledModules.length > 0
          ? data.enabledModules
          : [...ALL_TENANT_MODULES],
      );
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        onLogout();
        return;
      }
      if (err.status === 404) {
        setError('Barbearia não encontrada.');
        return;
      }
      setError(err.message || 'Erro ao carregar barbearia');
    } finally {
      setLoading(false);
    }
  }, [tenantId, onLogout]);

  useEffect(() => {
    loadTenant();
  }, [loadTenant]);

  if (tenantId && params.tab && !VALID_PLATFORM_TENANT_TABS.includes(params.tab)) {
    return <Navigate to={platformTenantTabPath(tenantId, DEFAULT_PLATFORM_TENANT_TAB)} replace />;
  }

  if (tenantId && !params.tab && location.pathname.endsWith(`/${tenantId}`)) {
    return <Navigate to={platformTenantTabPath(tenantId, DEFAULT_PLATFORM_TENANT_TAB)} replace />;
  }

  const toggleStatus = async () => {
    if (!tenant) return;
    const suspending = tenant.status === 'active';
    if (suspending) {
      const ok = window.confirm(
        'Suspender esta barbearia? Clientes deixam de agendar e a equipa não consegue aceder ao painel.',
      );
      if (!ok) return;
    }
    try {
      await platformFetch(`/tenants/${tenant.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: suspending ? 'suspended' : 'active' }),
      });
      await loadTenant();
      setToast(suspending ? 'Barbearia suspensa.' : 'Barbearia reativada.');
    } catch (err) {
      setError(err.message || 'Erro ao atualizar status');
    }
  };

  const saveTenant = async (e) => {
    e.preventDefault();
    setSavingTenant(true);
    setError('');
    try {
      await platformFetch(`/tenants/${tenantId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: tenantForm.name,
          slug: slugify(tenantForm.slug),
          phone: tenantForm.phone,
          email: tenantForm.email,
          address: tenantForm.address,
        }),
      });
      await loadTenant();
      setToast('Dados da barbearia atualizados.');
    } catch (err) {
      setError(err.message || 'Erro ao salvar barbearia');
    } finally {
      setSavingTenant(false);
    }
  };

  const saveManager = async (e) => {
    e.preventDefault();
    setSavingManager(true);
    setError('');
    try {
      const body = { name: managerForm.name, email: managerForm.email };
      if (newPassword.trim()) {
        const pwdErr = validateStrongPassword(newPassword);
        if (pwdErr) {
          setError(pwdErr);
          setSavingManager(false);
          return;
        }
        body.password = newPassword;
      }
      await platformFetch(`/tenants/${tenantId}/manager`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      setNewPassword('');
      await loadTenant();
      setToast(body.password ? 'Gerente atualizado e senha redefinida.' : 'Gerente atualizado.');
    } catch (err) {
      setError(err.message || 'Erro ao salvar gerente');
    } finally {
      setSavingManager(false);
    }
  };

  const toggleModule = (moduleId) => {
    setEnabledModules((prev) => {
      if (prev.includes(moduleId)) {
        if (prev.length <= 1) return prev;
        return prev.filter((mid) => mid !== moduleId);
      }
      return ALL_TENANT_MODULES.filter((mid) => prev.includes(mid) || mid === moduleId);
    });
  };

  const saveModules = async () => {
    setSavingModules(true);
    setError('');
    try {
      await platformFetch(`/tenants/${tenantId}/modules`, {
        method: 'PATCH',
        body: JSON.stringify({ enabledModules }),
      });
      await loadTenant();
      setToast('Módulos da barbearia atualizados.');
    } catch (err) {
      setError(err.message || 'Erro ao salvar módulos');
    } finally {
      setSavingModules(false);
    }
  };

  const urls = tenant ? tenantPublicUrls(tenant.slug) : null;
  const tabLabel = PLATFORM_TENANT_TABS.find((t) => t.id === activeTab)?.label || activeTab;

  const tabProps = { tenantId, onToast: setTabToast, onError: setTabError };

  const tabNav = tenant ? (
    <div className="dash-toggle-group platform-tab-nav" role="tablist" aria-label="Seções da barbearia">
      {PLATFORM_TENANT_TABS.map((tab) => (
        <NavLink
          key={tab.id}
          to={platformTenantTabPath(tenantId, tab.id)}
          role="tab"
          className={({ isActive }) => `dash-toggle-btn${isActive ? ' active' : ''}`}
        >
          {tab.label}
        </NavLink>
      ))}
    </div>
  ) : null;

  const breadcrumb = (
    <nav className="platform-breadcrumb" aria-label="Navegação">
      <Link to="/admin/barbearias">Barbearias</Link>
      <span aria-hidden>→</span>
      {tenant ? (
        <>
          <Link to={platformTenantTabPath(tenantId, DEFAULT_PLATFORM_TENANT_TAB)}>{tenant.name}</Link>
          <span aria-hidden>→</span>
          <span>{tabLabel}</span>
        </>
      ) : (
        <span>…</span>
      )}
    </nav>
  );

  return (
    <PlatformLayout onLogout={onLogout}>
      <PlatformToast message={toast} onClear={() => setToast('')} />

      <PlatformPageShell
        title={tenant?.name || (loading ? 'Carregando…' : 'Barbearia')}
        subtitle={tenant ? (
          <span className="platform-detail-meta">
            <PlatformStatusBadge status={tenant.status} />
            <code className="platform-slug">{tenant.slug}</code>
          </span>
        ) : null}
        breadcrumb={breadcrumb}
        tabs={!loading && tenant ? tabNav : null}
        actions={(
          <Link to="/admin/barbearias" className="dash-action-btn secondary platform-back-link">
            <ArrowLeft size={16} aria-hidden />
            Voltar
          </Link>
        )}
      >
        {error && <p className="platform-form-error">{error}</p>}

        {loading ? (
          <p className="platform-loading">Carregando…</p>
        ) : tenant ? (
          <>
            {activeTab === 'resumo' && (
              <div role="tabpanel">
                <div className="dash-kpi-section">
                  <div className="dash-kpi-section-header">
                    <span className="dash-kpi-section-title">Indicadores</span>
                  </div>
                  <div className="dash-kpi-row platform-kpi-row">
                    <PlatformKpiCard label="Profissionais" value={tenant._count?.barbers ?? 0} />
                    <PlatformKpiCard label="Agendamentos" value={tenant._count?.appointments ?? 0} />
                    <PlatformKpiCard label="Clientes" value={tenant._count?.customers ?? 0} />
                    <PlatformKpiCard label="Serviços" value={tenant._count?.services ?? 0} />
                  </div>
                </div>

                <PlatformPanel title="Contacto">
                  <div className="platform-info-grid">
                    <InfoRow label="E-mail" value={tenant.email} icon={<Mail size={16} />} />
                    <InfoRow label="Telefone" value={tenant.phone} icon={<Phone size={16} />} />
                    <InfoRow label="Endereço" value={tenant.address} icon={<MapPin size={16} />} />
                    {(tenant.tagline || tenant.slogan) && (
                      <InfoRow label="Tagline" value={tenant.tagline || tenant.slogan} />
                    )}
                  </div>
                  <p className="platform-field-hint">
                    Criada em {formatDate(tenant.createdAt)} · Atualizada em {formatDate(tenant.updatedAt)}
                  </p>
                </PlatformPanel>

                <PlatformPanel title="Módulos ativos">
                  <div className="platform-module-badges">
                    {(tenant.enabledModules || []).map((moduleId) => (
                      <span key={moduleId} className="platform-module-badge">
                        {TENANT_MODULE_LABELS[moduleId] || moduleId}
                      </span>
                    ))}
                  </div>
                </PlatformPanel>

                <PlatformPanel title="Acesso rápido">
                  <div className="platform-detail-actions">
                    <Link to={platformTenantTabPath(tenantId, 'equipe')} className="dash-action-btn primary">
                      Gerir operações
                    </Link>
                    <a href={urls.cliente} target="_blank" rel="noreferrer" className="dash-action-btn secondary">
                      <ExternalLink size={14} aria-hidden />
                      Abrir agendamento público
                    </a>
                    {tenant.status === 'active' ? (
                      <button type="button" className="dash-action-btn secondary" onClick={toggleStatus}>
                        Suspender barbearia
                      </button>
                    ) : (
                      <button type="button" className="dash-action-btn primary" onClick={toggleStatus}>
                        Reativar barbearia
                      </button>
                    )}
                  </div>
                  <ul className="platform-link-list">
                    <li>
                      <span>Agendamento:</span>
                      <a href={urls.cliente} target="_blank" rel="noreferrer">{urls.cliente}</a>
                      <button type="button" className="dash-icon-btn" title="Copiar" onClick={() => copyWithToast(urls.cliente, setToast)}>
                        <Copy size={14} />
                      </button>
                    </li>
                  </ul>
                </PlatformPanel>
              </div>
            )}

            {activeTab === 'equipe' && (
              <div role="tabpanel">
                <PlatformTenantTeamTab {...tabProps} />
              </div>
            )}

            {activeTab === 'estoque' && (
              <div role="tabpanel">
                <PlatformTenantInventoryTab {...tabProps} />
              </div>
            )}

            {activeTab === 'configuracao' && (
              <div role="tabpanel">
                <PlatformTenantSettingsTab {...tabProps} />
                <PlatformPanel title="Dados administrativos">
                  <form className="platform-form" onSubmit={saveTenant}>
                    <label>
                      Nome
                      <input className="booking-reserve-form__field" value={tenantForm.name} onChange={(e) => setTenantForm({ ...tenantForm, name: e.target.value })} required />
                    </label>
                    <label>
                      URL (slug)
                      <input className="booking-reserve-form__field" value={tenantForm.slug} onChange={(e) => setTenantForm({ ...tenantForm, slug: slugify(e.target.value) })} required />
                    </label>
                    <label>
                      Telefone
                      <input className="booking-reserve-form__field" value={tenantForm.phone} onChange={(e) => setTenantForm({ ...tenantForm, phone: e.target.value })} />
                    </label>
                    <label>
                      E-mail de contacto
                      <input type="email" className="booking-reserve-form__field" value={tenantForm.email} onChange={(e) => setTenantForm({ ...tenantForm, email: e.target.value })} />
                    </label>
                    <label>
                      Endereço
                      <input className="booking-reserve-form__field" value={tenantForm.address} onChange={(e) => setTenantForm({ ...tenantForm, address: e.target.value })} />
                    </label>
                    <div className="platform-modal-actions">
                      <button type="submit" className="dash-action-btn primary" disabled={savingTenant}>
                        {savingTenant ? 'Salvando…' : 'Salvar barbearia'}
                      </button>
                    </div>
                  </form>
                </PlatformPanel>

                <PlatformPanel title="Gerente principal">
                  {tenant.manager ? (
                    <form className="platform-form" onSubmit={saveManager}>
                      <label>
                        Nome
                        <input className="booking-reserve-form__field" value={managerForm.name} onChange={(e) => setManagerForm({ ...managerForm, name: e.target.value })} required />
                      </label>
                      <label>
                        E-mail
                        <input type="email" className="booking-reserve-form__field" value={managerForm.email} onChange={(e) => setManagerForm({ ...managerForm, email: e.target.value })} required />
                      </label>
                      <label>
                        Nova senha (opcional)
                        <div className="platform-password-field">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            className="booking-reserve-form__field"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            autoComplete="new-password"
                            placeholder="Deixe vazio para manter a atual"
                          />
                          <button
                            type="button"
                            className="platform-password-toggle"
                            onClick={() => setShowPassword((v) => !v)}
                            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                          >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                        <span className="platform-field-hint">Mín. 8 caracteres, maiúscula, minúscula e número.</span>
                      </label>
                      <div className="platform-modal-actions">
                        <button type="submit" className="dash-action-btn primary" disabled={savingManager}>
                          {savingManager ? 'Salvando…' : 'Salvar gerente'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <p className="platform-page-subtitle">Nenhum gerente encontrado.</p>
                  )}
                </PlatformPanel>
              </div>
            )}

            {activeTab === 'modulos' && (
              <div role="tabpanel">
                <PlatformPanel title="Módulos da barbearia">
                  <p className="platform-field-hint" style={{ marginBottom: '1rem' }}>
                    Módulos desligados deixam de aparecer para toda a equipa. As alterações aplicam-se no próximo reload ou login da equipa.
                  </p>
                  <div className="platform-form" style={{ gap: '0.75rem' }}>
                    {ALL_TENANT_MODULES.map((moduleId) => (
                      <label key={moduleId} className="platform-checkbox-label">
                        <input
                          type="checkbox"
                          checked={enabledModules.includes(moduleId)}
                          onChange={() => toggleModule(moduleId)}
                        />
                        {TENANT_MODULE_LABELS[moduleId]}
                      </label>
                    ))}
                  </div>
                  <div className="platform-modal-actions" style={{ marginTop: '1rem' }}>
                    <button type="button" className="dash-action-btn primary" disabled={savingModules} onClick={saveModules}>
                      {savingModules ? 'Salvando…' : 'Salvar módulos'}
                    </button>
                  </div>
                </PlatformPanel>
              </div>
            )}
          </>
        ) : (
          <button type="button" className="dash-action-btn secondary" onClick={() => navigate('/admin/barbearias')}>
            Voltar à lista
          </button>
        )}
      </PlatformPageShell>
    </PlatformLayout>
  );
}
