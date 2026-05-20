import React, { useCallback, useEffect, useState } from 'react';
import { Copy, Plus, ExternalLink } from 'lucide-react';
import { platformFetch, tenantPublicUrls } from './platformAuth';
import CreateTenantModal from './CreateTenantModal';
import PlatformLayout from './PlatformLayout';

function StatusBadge({ status }) {
  const active = status === 'active';
  return (
    <span className={`platform-status-badge ${active ? 'platform-status-badge--active' : 'platform-status-badge--suspended'}`}>
      {active ? 'Ativa' : 'Suspensa'}
    </span>
  );
}

function copyText(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return Promise.reject(new Error('Clipboard não disponível'));
}

export default function PlatformTenantsPage({ onLogout }) {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [successBanner, setSuccessBanner] = useState(null);

  const loadTenants = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await platformFetch('/platform/tenants');
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
  }, [onLogout]);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  const toggleStatus = async (id, status) => {
    try {
      await platformFetch(`/platform/tenants/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await loadTenants();
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
      <div className="glass-card platform-tenants-card">
        <div className="platform-tenants-toolbar">
          <div>
            <h1 className="platform-page-title">Barbearias</h1>
            <p className="platform-page-subtitle">Cadastre e gerencie os clientes da plataforma Sloot.</p>
          </div>
          <button type="button" className="btn-primary" onClick={() => setModalOpen(true)}>
            <Plus size={18} aria-hidden />
            Nova barbearia
          </button>
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
                <button type="button" className="dash-icon-btn" title="Copiar" onClick={() => copyText(successBanner.urls.cliente)}>
                  <Copy size={14} />
                </button>
              </li>
              <li>
                <span>Painel equipe:</span>
                <a href={successBanner.urls.staffLogin} target="_blank" rel="noreferrer">
                  {successBanner.urls.staffLogin}
                </a>
                <button type="button" className="dash-icon-btn" title="Copiar" onClick={() => copyText(successBanner.urls.staffLogin)}>
                  <Copy size={14} />
                </button>
              </li>
            </ul>
            <button type="button" className="btn-secondary" style={{ marginTop: '8px' }} onClick={() => setSuccessBanner(null)}>
              Fechar
            </button>
          </div>
        )}

        {error && <p className="platform-form-error">{error}</p>}

        {loading ? (
          <p className="platform-loading">Carregando…</p>
        ) : (
          <div className="platform-table-wrap">
            <table className="platform-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Slug</th>
                  <th>Status</th>
                  <th>Profissionais</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {tenants.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="platform-table-empty">
                      Nenhuma barbearia cadastrada. Clique em Nova barbearia.
                    </td>
                  </tr>
                ) : (
                  tenants.map((t) => {
                    const urls = tenantPublicUrls(t.slug);
                    return (
                      <tr key={t.id}>
                        <td>{t.name}</td>
                        <td>
                          <code className="platform-slug">{t.slug}</code>
                        </td>
                        <td>
                          <StatusBadge status={t.status} />
                        </td>
                        <td>{t._count?.barbers ?? '—'}</td>
                        <td className="platform-table-actions">
                          <a href={urls.cliente} target="_blank" rel="noreferrer" className="btn-secondary platform-table-btn" title="Abrir agendamento">
                            <ExternalLink size={14} />
                          </a>
                          <button type="button" className="btn-secondary platform-table-btn" title="Copiar link agendamento" onClick={() => copyText(urls.cliente)}>
                            <Copy size={14} />
                          </button>
                          {t.status === 'active' ? (
                            <button type="button" className="btn-secondary platform-table-btn" onClick={() => toggleStatus(t.id, 'suspended')}>
                              Suspender
                            </button>
                          ) : (
                            <button type="button" className="btn-primary platform-table-btn" onClick={() => toggleStatus(t.id, 'active')}>
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
        )}
      </div>

      <CreateTenantModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={handleCreated} />
    </PlatformLayout>
  );
}
