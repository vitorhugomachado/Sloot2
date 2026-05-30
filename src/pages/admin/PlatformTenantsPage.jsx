import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Copy, Plus, ExternalLink } from 'lucide-react';
import { buildTenantListQuery, platformFetch, tenantPublicUrls } from './platformAuth';
import CreateTenantModal from './CreateTenantModal';
import PlatformLayout from './PlatformLayout';
import PlatformPageShell, { PlatformPanel } from './PlatformPageShell';
import PlatformStatusBadge from './PlatformStatusBadge';
import PlatformToast from './PlatformToast';
import { copyWithToast } from './platformCopy';

export default function PlatformTenantsPage({ onLogout }) {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [successBanner, setSuccessBanner] = useState(null);
  const [toast, setToast] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sort, setSort] = useState('createdAt_desc');

  const loadTenants = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const path = buildTenantListQuery({ q: search, status: statusFilter, sort });
      const rows = await platformFetch(path);
      setTenants(Array.isArray(rows) ? rows : []);
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        onLogout();
        return;
      }
      setError(err.message || 'Erro ao carregar barbearias');
    } finally {
      setLoading(false);
    }
  }, [onLogout, search, statusFilter, sort]);

  useEffect(() => {
    const t = window.setTimeout(() => loadTenants(), search ? 300 : 0);
    return () => window.clearTimeout(t);
  }, [loadTenants, search]);

  const toggleStatus = async (tenant) => {
    const suspending = tenant.status === 'active';
    if (suspending) {
      const ok = window.confirm(
        `Suspender ${tenant.name}? Clientes deixam de agendar e a equipa não consegue aceder ao painel.`,
      );
      if (!ok) return;
    }
    try {
      await platformFetch(`/tenants/${tenant.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: suspending ? 'suspended' : 'active' }),
      });
      await loadTenants();
      setToast(suspending ? 'Barbearia suspensa.' : 'Barbearia reativada.');
    } catch (err) {
      setError(err.message || 'Erro ao atualizar status');
    }
  };

  const handleCreated = (result) => {
    const slug = result?.tenant?.slug;
    if (slug) {
      const urls = tenantPublicUrls(slug);
      setSuccessBanner({
        name: result.tenant.name,
        slug,
        urls,
      });
    }
    loadTenants();
  };

  return (
    <PlatformLayout onLogout={onLogout}>
      <PlatformToast message={toast} onClear={() => setToast('')} />

      <PlatformPageShell
        title="Barbearias"
        subtitle="Cadastre e gerencie os clientes da plataforma slooti."
        actions={(
          <button type="button" className="dash-action-btn primary" onClick={() => setModalOpen(true)}>
            <Plus size={16} aria-hidden />
            Nova barbearia
          </button>
        )}
      >
        <div className="platform-filters">
          <input
            type="search"
            className="booking-reserve-form__field platform-filter-input"
            placeholder="Buscar por nome, slug ou e-mail…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="booking-reserve-form__field platform-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Todos os status</option>
            <option value="active">Ativas</option>
            <option value="suspended">Suspensas</option>
          </select>
          <select
            className="booking-reserve-form__field platform-filter-select"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="createdAt_desc">Mais recentes</option>
            <option value="createdAt_asc">Mais antigas</option>
            <option value="name_asc">Nome A–Z</option>
            <option value="name_desc">Nome Z–A</option>
          </select>
        </div>

        {successBanner && (
          <div className="platform-success-banner">
            <p>
              <strong>{successBanner.name}</strong> criada com sucesso.
            </p>
            <ul className="platform-link-list">
              <li>
                <span>Agendamento:</span>
                <a href={successBanner.urls.cliente} target="_blank" rel="noreferrer">
                  {successBanner.urls.cliente}
                </a>
                <button type="button" className="dash-icon-btn" title="Copiar" onClick={() => copyWithToast(successBanner.urls.cliente, setToast)}>
                  <Copy size={14} />
                </button>
              </li>
              <li>
                <span>Painel equipe:</span>
                <a href={successBanner.urls.staffLogin} target="_blank" rel="noreferrer">
                  {successBanner.urls.staffLogin}
                </a>
                <button type="button" className="dash-icon-btn" title="Copiar" onClick={() => copyWithToast(successBanner.urls.staffLogin, setToast)}>
                  <Copy size={14} />
                </button>
              </li>
            </ul>
            <button type="button" className="dash-action-btn secondary" style={{ marginTop: '8px' }} onClick={() => setSuccessBanner(null)}>
              Fechar
            </button>
          </div>
        )}

        {error && <p className="platform-form-error">{error}</p>}

        {loading ? (
          <p className="platform-loading">Carregando…</p>
        ) : (
          <PlatformPanel title="Lista de barbearias">
            <div className="platform-table-wrap">
            <table className="platform-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Slug</th>
                  <th>Status</th>
                  <th>Profissionais</th>
                  <th>Agendamentos</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {tenants.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="platform-table-empty">
                      Nenhuma barbearia encontrada.
                    </td>
                  </tr>
                ) : (
                  tenants.map((t) => {
                    const urls = tenantPublicUrls(t.slug);
                    const openDetail = () => navigate(`/admin/barbearias/${t.id}/resumo`);
                    return (
                      <tr
                        key={t.id}
                        className="platform-table-row--clickable"
                        onClick={openDetail}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openDetail();
                          }
                        }}
                        tabIndex={0}
                        role="link"
                        aria-label={`Ver detalhes de ${t.name}`}
                      >
                        <td>
                          <Link to={`/admin/barbearias/${t.id}/resumo`} className="platform-link">
                            {t.name}
                          </Link>
                        </td>
                        <td>
                          <code className="platform-slug">{t.slug}</code>
                        </td>
                        <td>
                          <PlatformStatusBadge status={t.status} />
                        </td>
                        <td>{t._count?.barbers ?? '—'}</td>
                        <td>{t._count?.appointments ?? '—'}</td>
                        <td className="platform-table-actions" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                          <Link to={`/admin/barbearias/${t.id}/resumo`} className="dash-action-btn secondary platform-table-btn">
                            Detalhe
                          </Link>
                          <a href={urls.cliente} target="_blank" rel="noreferrer" className="dash-action-btn secondary platform-table-btn" title="Abrir agendamento">
                            <ExternalLink size={14} />
                          </a>
                          <button type="button" className="dash-action-btn secondary platform-table-btn" title="Copiar link agendamento" onClick={() => copyWithToast(urls.cliente, setToast)}>
                            <Copy size={14} />
                          </button>
                          {t.status === 'active' ? (
                            <button type="button" className="dash-action-btn secondary platform-table-btn" onClick={() => toggleStatus(t)}>
                              Suspender
                            </button>
                          ) : (
                            <button type="button" className="dash-action-btn primary platform-table-btn" onClick={() => toggleStatus(t)}>
                              Reativar
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            </div>
          </PlatformPanel>
        )}
      </PlatformPageShell>

      <CreateTenantModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={handleCreated} />
    </PlatformLayout>
  );
}
