import React from 'react';
import { Receipt, Wallet } from 'lucide-react';
import {
  money,
  formatWhen,
  comandaSeriesLabel,
  comandaStatusLabel,
  comandaStatusTone,
  printComandaReceipt,
  EmptyState,
  ModalShell,
  StatusPill,
} from './shared';

export default function ComandaDetailModal({
  comanda,
  businessInfo,
  isGerente,
  onClose,
  onSettle,
  onReverse,
  onViewSession,
}) {
  if (!comanda) return null;

  const meta = comanda.settlementMeta || {};
  const status = String(comanda.status || '').toUpperCase();
  const timeline = meta.timeline || [];
  const cashSessionId = comanda.cashSessionId || comanda.cashSession?.id;

  return (
    <ModalShell
      title={`Comanda ${comandaSeriesLabel(comanda)}`}
      subtitle={`${comanda.customerName} · ${comandaStatusLabel(status)}`}
      onClose={onClose}
      wide
    >
      <div className="finv2-cash-metrics" style={{ marginBottom: 16 }}>
        <div>
          <span>Total</span>
          <strong className="finv2-num">{money(comanda.total)}</strong>
        </div>
        <div>
          <span>Status</span>
          <strong style={{ fontSize: '0.9rem' }}>
            <StatusPill tone={comandaStatusTone(status)}>{comandaStatusLabel(status)}</StatusPill>
          </strong>
        </div>
        {status === 'PARTIAL' || meta.paidAmount != null ? (
          <div>
            <span>Pago</span>
            <strong className="finv2-num">{money(meta.paidAmount)}</strong>
          </div>
        ) : null}
        {status === 'PARTIAL' ? (
          <div>
            <span>Em aberto</span>
            <strong className="is-out finv2-num">{money(meta.balanceDue)}</strong>
          </div>
        ) : null}
        <div>
          <span>Abertura</span>
          <strong style={{ fontSize: '0.9rem' }}>{formatWhen(comanda.openedAt)}</strong>
        </div>
        <div>
          <span>Quitação</span>
          <strong style={{ fontSize: '0.9rem' }}>{formatWhen(comanda.closedAt)}</strong>
        </div>
      </div>

      {timeline.length ? (
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ margin: '0 0 8px', fontSize: '0.9rem' }}>Linha do tempo</h4>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.88rem' }}>
            {timeline.map((t, i) => (
              <li key={i}>
                <strong>{t.label}</strong> · {formatWhen(t.at)}
              </li>
            ))}
          </ul>
          {meta.settledByName ? (
            <p className="finv2-panel__hint" style={{ marginTop: 6 }}>
              Quitada por {meta.settledByName}
            </p>
          ) : null}
          {(meta.discountAmount || meta.tipAmount) ? (
            <p className="finv2-panel__hint">
              {meta.discountAmount ? <>Desconto −{money(meta.discountAmount)} · </> : null}
              {meta.tipAmount ? <>Gorjeta +{money(meta.tipAmount)}</> : null}
            </p>
          ) : null}
        </div>
      ) : null}

      {(comanda.items || []).length ? (
        <div className="finv2-table-wrap">
          <table className="finv2-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Tipo</th>
                <th className="is-right">Qtd</th>
                <th className="is-right">Unit.</th>
                <th className="is-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {comanda.items.map((item) => (
                <tr key={item.id}>
                  <td className="is-strong">{item.name}</td>
                  <td>{item.itemType === 'PRODUCT' ? 'Produto' : 'Serviço'}</td>
                  <td className="is-right">{item.quantity}</td>
                  <td className="is-right finv2-num">{money(item.unitPrice)}</td>
                  <td className="is-right is-strong finv2-num">{money(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="Sem itens" hint="Comanda sem itens detalhados." />
      )}

      {Array.isArray(comanda.payments?.splits) && comanda.payments.splits.length ? (
        <div style={{ marginTop: 16 }}>
          <h4 style={{ margin: '0 0 8px', fontSize: '0.9rem' }}>Pagamentos</h4>
          {(comanda.payments.discountAmount || comanda.payments.tipAmount) ? (
            <p style={{ margin: '0 0 8px', fontSize: '0.85rem' }}>
              {comanda.payments.discountAmount
                ? <>Desconto −{money(comanda.payments.discountAmount)} · </>
                : null}
              {comanda.payments.tipAmount
                ? <>Gorjeta +{money(comanda.payments.tipAmount)} · </>
                : null}
              Total {money(comanda.payments.totalCheckout ?? comanda.total)}
            </p>
          ) : null}
          <div className="finv2-table-wrap">
            <table className="finv2-table">
              <thead>
                <tr>
                  <th>Forma</th>
                  <th>Bandeira</th>
                  <th className="is-right">Valor</th>
                  <th className="is-right">Taxa</th>
                </tr>
              </thead>
              <tbody>
                {comanda.payments.splits.map((s, i) => (
                  <tr key={i}>
                    <td>{s.method}</td>
                    <td className="is-muted">
                      {s.cardBrand
                        ? `${s.cardBrand}${s.cardKind === 'DEBIT' ? ' débito' : s.cardKind === 'CREDIT' ? ' crédito' : ''}`
                        : '—'}
                    </td>
                    <td className="is-right is-in is-strong finv2-num">{money(s.amount)}</td>
                    <td className="is-right is-out finv2-num">
                      {Number(s.feeAmount || 0) > 0
                        ? `${money(s.feeAmount)} (${s.feePct}%)`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {Number(comanda.payments.cardFeeTotal || 0) > 0 ? (
            <p style={{ margin: '8px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Taxa de cartão total {money(comanda.payments.cardFeeTotal)} — debitada da comissão do profissional.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="finv2-modal__actions">
        <button
          type="button"
          className="finv2-btn"
          onClick={() => printComandaReceipt(comanda, money, businessInfo)}
        >
          <Receipt size={15} /> Imprimir recibo
        </button>
        {cashSessionId ? (
          <button type="button" className="finv2-btn" onClick={() => onViewSession(cashSessionId)}>
            <Wallet size={15} /> Ver caixa desta comanda
          </button>
        ) : null}
        {status === 'OPEN' ? (
          <button type="button" className="btn-primary" onClick={() => onSettle(comanda, {})}>
            Confirmar recebimento
          </button>
        ) : null}
        {status === 'PARTIAL' ? (
          <button
            type="button"
            className="btn-primary"
            onClick={() => onSettle(comanda, { remaining: true })}
          >
            Receber restante
          </button>
        ) : null}
        {status === 'QUITADA' && isGerente ? (
          <button type="button" className="finv2-btn" onClick={() => onReverse(comanda)}>
            Estornar
          </button>
        ) : null}
        <button type="button" className="btn-secondary" onClick={onClose}>
          Fechar
        </button>
      </div>
    </ModalShell>
  );
}
