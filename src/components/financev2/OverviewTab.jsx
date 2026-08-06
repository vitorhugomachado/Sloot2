import React from 'react';
import { ChevronRight, ClipboardList, Receipt } from 'lucide-react';
import {
  money,
  formatDateBr,
  formatWhen,
  comandaSeriesLabel,
  comandaStatusLabel,
  comandaStatusTone,
  comandaBalanceDue,
  EmptyState,
  StatusPill,
} from './shared';

export default function OverviewTab({
  kpis,
  summary,
  entries,
  openComandas,
  onOpenComanda,
  onGoToComandas,
}) {
  const lastEntries = (entries || []).slice(0, 8);
  const goal = kpis?.monthlyRevenueGoal;
  const goalPct = kpis?.goalProgress != null ? Math.max(0, Number(kpis.goalProgress)) : null;

  return (
    <div className="finv2-stack">
      <div className="dash-kpi-row finv2-kpi-row">
        <div className="dash-kpi-card stagger-1">
          <div className="dash-kpi-top">
            <span className="dash-kpi-label">Receita do período</span>
          </div>
          <div className="dash-kpi-value">{money(summary?.totalReceitas)}</div>
          <div className="dash-kpi-subtitle">Comandas quitadas no período</div>
        </div>
        <div className="dash-kpi-card stagger-2">
          <div className="dash-kpi-top">
            <span className="dash-kpi-label">Resultado</span>
          </div>
          <div className="dash-kpi-value">{money(summary?.resultado)}</div>
          <div className="dash-kpi-subtitle">Receitas − despesas</div>
        </div>
        <div className="dash-kpi-card stagger-3">
          <div className="dash-kpi-top">
            <span className="dash-kpi-label">Ticket médio</span>
          </div>
          <div className="dash-kpi-value">{money(kpis?.ticketMedio)}</div>
          <div className="dash-kpi-subtitle">Por comanda quitada</div>
        </div>
        <div className="dash-kpi-card stagger-4">
          <div className="dash-kpi-top">
            <span className="dash-kpi-label">Meta do mês</span>
          </div>
          {goal != null ? (
            <>
              <div className="dash-kpi-value">
                {goalPct != null ? `${goalPct.toFixed(0)}%` : '—'}
              </div>
              <div className="dash-occ-bar-track">
                <div
                  className="dash-occ-bar-fill"
                  style={{ width: `${Math.min(100, goalPct ?? 0)}%` }}
                />
              </div>
              <div className="dash-kpi-subtitle">Meta {money(goal)}</div>
            </>
          ) : (
            <>
              <div className="dash-kpi-value">—</div>
              <div className="dash-kpi-subtitle">Defina a meta mensal em Configurações</div>
            </>
          )}
        </div>
      </div>

      <div className="finv2-overview-grid">
        <div className="glass-card finv2-panel">
          <div className="finv2-panel__head">
            <h3>Últimos lançamentos</h3>
            <span>{lastEntries.length ? `${lastEntries.length} mais recentes` : ''}</span>
          </div>
          {lastEntries.length ? (
            <div className="finv2-table-wrap">
              <table className="finv2-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Título</th>
                    <th className="is-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {lastEntries.map((e) => (
                    <tr key={e.id}>
                      <td className="is-muted">{formatDateBr(e.date)}</td>
                      <td className="is-strong">{e.title}</td>
                      <td className={`is-right is-strong finv2-num ${e.amount < 0 ? 'is-out' : 'is-in'}`}>
                        {money(e.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={Receipt}
              title="Sem lançamentos"
              hint="Recebimentos e saídas do período aparecem aqui."
            />
          )}
        </div>

        <div className="glass-card finv2-panel">
          <div className="finv2-panel__head">
            <h3>Comandas em aberto</h3>
            <span>{(openComandas || []).length} comandas</span>
          </div>
          {(openComandas || []).length ? (
            <div className="finv2-overview-list">
              {openComandas.map((c) => {
                const balanceDue = comandaBalanceDue(c);
                const isPartial = String(c.status || '').toUpperCase() === 'PARTIAL';
                return (
                  <button
                    key={c.id}
                    type="button"
                    className="finv2-overview-row"
                    onClick={() => onOpenComanda(c.id)}
                  >
                    <span className="finv2-overview-row__main">
                      <strong>{c.customerName || '—'}</strong>
                      <span className="finv2-overview-row__meta">
                        {comandaSeriesLabel(c)} · {formatWhen(c.openedAt)}
                      </span>
                    </span>
                    <span className="finv2-overview-row__side">
                      <StatusPill tone={comandaStatusTone(c.status)}>
                        {comandaStatusLabel(c.status)}
                      </StatusPill>
                      {isPartial && balanceDue > 0 ? (
                        <span className="finv2-pill finv2-pill--warn">
                          Em aberto {money(balanceDue)}
                        </span>
                      ) : null}
                      <strong className="finv2-num">{money(c.total)}</strong>
                      <ChevronRight size={15} strokeWidth={2} />
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={ClipboardList}
              title="Nenhuma comanda em aberto"
              hint="Tudo quitado por aqui."
            />
          )}
          <button
            type="button"
            className="finv2-btn finv2-btn--block"
            onClick={onGoToComandas}
          >
            Ver comandas
          </button>
        </div>
      </div>
    </div>
  );
}
