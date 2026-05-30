import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { platformFetch } from './platformAuth';
import PlatformLayout from './PlatformLayout';
import PlatformPageShell, { PlatformKpiCard, PlatformPanel } from './PlatformPageShell';

export default function PlatformDashboardPage({ onLogout }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await platformFetch('/stats');
      setStats(data);
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        onLogout();
        return;
      }
      setError(err.message || 'Erro ao carregar estatísticas');
    } finally {
      setLoading(false);
    }
  }, [onLogout]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return (
    <PlatformLayout onLogout={onLogout}>
      <PlatformPageShell
        title="Visão geral"
        subtitle="Resumo da plataforma slooti."
      >
        {error && <p className="platform-form-error">{error}</p>}

        {loading ? (
          <p className="platform-loading">Carregando…</p>
        ) : stats ? (
          <>
            <div className="dash-kpi-section">
              <div className="dash-kpi-section-header">
                <span className="dash-kpi-section-title">Indicadores</span>
              </div>
              <div className="dash-kpi-row platform-kpi-row">
                <PlatformKpiCard label="Barbearias ativas" value={stats.tenants?.active ?? 0} />
                <PlatformKpiCard label="Barbearias suspensas" value={stats.tenants?.suspended ?? 0} />
                <PlatformKpiCard
                  label="Novas (7 dias)"
                  value={stats.tenants?.newLast7Days ?? 0}
                  hint={`${stats.tenants?.newLast30Days ?? 0} nos últimos 30 dias`}
                />
                <PlatformKpiCard label="Agendamentos totais" value={stats.appointments?.total ?? 0} />
              </div>
            </div>

            <PlatformPanel title="Top 5 por agendamentos">
              {stats.topTenants?.length ? (
                <div className="platform-table-wrap">
                  <table className="platform-table">
                    <thead>
                      <tr>
                        <th>Barbearia</th>
                        <th>Status</th>
                        <th>Agendamentos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.topTenants.map((t) => (
                        <tr
                          key={t.id}
                          className="platform-table-row--clickable"
                          onClick={() => navigate(`/admin/barbearias/${t.id}/resumo`)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              navigate(`/admin/barbearias/${t.id}/resumo`);
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
                          <td>{t.status === 'active' ? 'Ativa' : 'Suspensa'}</td>
                          <td>{t.appointments}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="platform-page-subtitle">Nenhuma barbearia cadastrada ainda.</p>
              )}
            </PlatformPanel>
          </>
        ) : null}
      </PlatformPageShell>
    </PlatformLayout>
  );
}
