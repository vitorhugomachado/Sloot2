import React, { useState } from 'react';
import { Download } from 'lucide-react';
import {
  money,
  formatWhen,
  formatDateBr,
  downloadCsv,
  comandaSeriesLabel,
  CashCloseReport,
  CollapsibleSection,
  ModalShell,
} from './shared';

function exportSessionCompositionCsv(session) {
  const comp = session?.composition || session || {};
  const comandasRows = comp.comandas || session?.comandas || [];
  const expensesRows = comp.expenses || session?.expenses || [];
  const adjustments = comp.adjustments || session?.adjustments || [];
  const header = ['Tipo', 'Data', 'Descrição', 'Cliente/Método', 'Valor'];
  const rows = [
    ...comandasRows.map((c) => [
      'Comanda',
      formatDateBr(c.closedAt || c.openedAt),
      `"${comandaSeriesLabel(c)}"`,
      `"${String(c.customerName || '').replace(/"/g, '""')}"`,
      String(c.total).replace('.', ','),
    ]),
    ...expensesRows.map((e) => [
      'Despesa',
      formatDateBr(e.paidAt || e.dueDate || e.date),
      `"${String(e.title || e.description || '').replace(/"/g, '""')}"`,
      e.paymentMethod || '',
      String(-(e.amount || 0)).replace('.', ','),
    ]),
    ...adjustments.map((m) => [
      m.type === 'IN' ? 'Suprimento' : 'Sangria',
      formatDateBr(m.createdAt),
      `"${String(m.description || '').replace(/"/g, '""')}"`,
      m.method || '',
      String(m.type === 'IN' ? m.amount : -m.amount).replace('.', ','),
    ]),
  ];
  downloadCsv(`caixa-${session?.id}-composicao.csv`, header, rows);
}

export default function SessionDetailModal({ session, canReopen, onClose, onOpenComanda, onReopenCash }) {
  const [expandedSections, setExpandedSections] = useState({});

  if (!session) return null;

  const toggleSection = (id) => {
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const comp = session.composition || {};
  const sessionComandas = comp.comandas || session.comandas || [];
  const sessionExpenses = comp.expenses || session.expenses || [];
  const sessionAdjustments = comp.adjustments || session.adjustments || [];
  const byMethodDetail = comp.byMethodDetail || session.byMethodDetail || {};
  const comandasTotal = sessionComandas.reduce((s, c) => s + Number(c.total || 0), 0);
  const expensesTotal = sessionExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const totals = session.totals || session.snapshot || {};

  return (
    <ModalShell
      title={`Caixa #${session.id}`}
      subtitle={`${session.status === 'OPEN' ? 'Aberto' : 'Fechado'} · ${formatWhen(session.openedAt)}`}
      onClose={onClose}
      wide
    >
      <div className="finv2-mini-kpi-row">
        <div className="finv2-mini-kpi">
          <span>Entradas</span>
          <strong className="is-in finv2-num">{money(totals.totalIn)}</strong>
        </div>
        <div className="finv2-mini-kpi">
          <span>Saídas</span>
          <strong className="is-out finv2-num">{money(totals.totalOut)}</strong>
        </div>
        <div className="finv2-mini-kpi">
          <span>Dinheiro esperado</span>
          <strong className="finv2-num">{money(totals.expectedCash)}</strong>
        </div>
      </div>

      <CashCloseReport session={session} hideTotals />

      <CollapsibleSection
        id="comandas"
        title={`Comandas (${sessionComandas.length}) — ${money(comandasTotal)}`}
        open={Boolean(expandedSections.comandas)}
        onToggle={toggleSection}
      >
        {sessionComandas.length ? (
          <div className="finv2-table-wrap">
            <table className="finv2-table">
              <thead>
                <tr>
                  <th>Nº</th>
                  <th>Cliente</th>
                  <th>Formas</th>
                  <th className="is-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {sessionComandas.map((c) => {
                  const splits = Array.isArray(c.payments?.splits) ? c.payments.splits : [];
                  return (
                    <tr
                      key={c.id}
                      className="finv2-row-click"
                      onClick={() => onOpenComanda(c.id)}
                    >
                      <td className="is-strong">{comandaSeriesLabel(c)}</td>
                      <td>{c.customerName}</td>
                      <td className="is-muted">
                        {splits.length
                          ? splits.map((s) => `${s.method} ${money(s.amount)}`).join(' · ')
                          : '—'}
                      </td>
                      <td className="is-right is-strong finv2-num">{money(c.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="finv2-panel__hint">Nenhuma comanda quitada nesta sessão.</p>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        id="despesas"
        title={`Despesas (${sessionExpenses.length}) — ${money(expensesTotal)}`}
        open={Boolean(expandedSections.despesas)}
        onToggle={toggleSection}
      >
        {sessionExpenses.length ? (
          <div className="finv2-table-wrap">
            <table className="finv2-table">
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Forma</th>
                  <th className="is-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {sessionExpenses.map((e) => (
                  <tr key={e.id}>
                    <td className="is-strong">{e.title || e.description}</td>
                    <td>{e.paymentMethod || '—'}</td>
                    <td className="is-right is-out finv2-num">{money(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="finv2-panel__hint">Nenhuma despesa nesta sessão.</p>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        id="ajustes"
        title={`Sangrias/Suprimentos (${sessionAdjustments.length})`}
        open={Boolean(expandedSections.ajustes)}
        onToggle={toggleSection}
      >
        {sessionAdjustments.length ? (
          <div className="finv2-table-wrap">
            <table className="finv2-table">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Tipo</th>
                  <th>Descrição</th>
                  <th className="is-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {sessionAdjustments.map((m) => (
                  <tr key={m.id}>
                    <td className="is-muted">{formatWhen(m.createdAt)}</td>
                    <td>{m.type === 'IN' ? 'Suprimento' : 'Sangria'}</td>
                    <td>{m.description}</td>
                    <td className={`is-right is-strong finv2-num ${m.type === 'IN' ? 'is-in' : 'is-out'}`}>
                      {money(m.type === 'IN' ? m.amount : -m.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="finv2-panel__hint">Sem sangrias ou suprimentos.</p>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        id="byMethod"
        title="Por forma de pagamento"
        open={Boolean(expandedSections.byMethod)}
        onToggle={toggleSection}
      >
        {Object.keys(byMethodDetail).length ? (
          <div className="finv2-stack" style={{ gap: 12 }}>
            {Object.entries(byMethodDetail).map(([method, rows]) => (
              <div key={method}>
                <h4 style={{ margin: '0 0 6px', fontSize: '0.85rem' }}>
                  {method} · {money((rows || []).reduce((s, r) => s + Number(r.amount || 0), 0))}
                </h4>
                <div className="finv2-table-wrap">
                  <table className="finv2-table">
                    <thead>
                      <tr>
                        <th>Comanda</th>
                        <th>Cliente</th>
                        <th className="is-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(rows || []).map((r, i) => (
                        <tr key={`${r.comandaId || i}-${i}`}>
                          <td>{r.number != null ? comandaSeriesLabel(r) : '—'}</td>
                          <td>{r.customerName || '—'}</td>
                          <td className="is-right is-in finv2-num">{money(r.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="finv2-panel__hint">Sem detalhamento por forma.</p>
        )}
      </CollapsibleSection>

      {session.movements?.length ? (
        <CollapsibleSection
          id="movements"
          title={`Movimentos (${session.movements.length})`}
          open={Boolean(expandedSections.movements)}
          onToggle={toggleSection}
        >
          <div className="finv2-table-wrap">
            <table className="finv2-table">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Tipo</th>
                  <th>Método</th>
                  <th>Descrição</th>
                  <th className="is-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {session.movements.map((m) => (
                  <tr key={m.id}>
                    <td className="is-muted">{formatWhen(m.createdAt)}</td>
                    <td>{m.type === 'IN' ? 'Entrada' : 'Saída'}</td>
                    <td>{m.method}</td>
                    <td>{m.description}</td>
                    <td className={`is-right is-strong finv2-num ${m.type === 'IN' ? 'is-in' : 'is-out'}`}>
                      {money(m.type === 'IN' ? m.amount : -m.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleSection>
      ) : null}

      <div className="finv2-modal__actions">
        <button
          type="button"
          className="finv2-btn"
          onClick={() => exportSessionCompositionCsv(session)}
        >
          <Download size={15} /> Exportar CSV da composição
        </button>
        {canReopen ? (
          <button type="button" className="btn-primary" onClick={() => onReopenCash(session.id)}>
            Reabrir caixa
          </button>
        ) : null}
        <button type="button" className="btn-secondary" onClick={onClose}>
          Fechar
        </button>
      </div>
    </ModalShell>
  );
}
