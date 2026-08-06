import React from 'react';
import { ChevronDown, ChevronRight, Receipt, X } from 'lucide-react';
import { formatDateBr } from '../../utils/dateLocal';

export { formatDateBr };

export function money(value) {
  return `R$ ${Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatWhen(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(value);
  }
}

export function downloadCsv(filename, header, rows) {
  const lines = [
    header.join(';'),
    ...rows.map((cols) => cols.join(';')),
  ];
  const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function comandaSeriesLabel(c) {
  if (!c?.number) return '—';
  const year = c.openedAt ? new Date(c.openedAt).getFullYear() : new Date().getFullYear();
  return `Nº${year}-${String(c.number).padStart(4, '0')}`;
}

export function comandaStatusLabel(status) {
  switch (String(status || '').toUpperCase()) {
    case 'PARTIAL':
      return 'Parcial';
    case 'QUITADA':
      return 'Quitada';
    case 'CANCELLED':
    case 'CANCELADA':
      return 'Cancelada';
    default:
      return 'Aberta';
  }
}

export function comandaStatusTone(status) {
  switch (String(status || '').toUpperCase()) {
    case 'PARTIAL':
      return 'warn';
    case 'QUITADA':
      return 'ok';
    case 'CANCELLED':
    case 'CANCELADA':
      return 'danger';
    default:
      return 'muted';
  }
}

export function comandaBalanceDue(c) {
  if (!c) return 0;
  const meta = c.settlementMeta || {};
  if (meta.balanceDue != null) return Number(meta.balanceDue);
  if (c.balanceDue != null) return Number(c.balanceDue);
  if (String(c.status || '').toUpperCase() !== 'PARTIAL') return 0;
  const paid = Number(meta.paidAmount ?? 0)
    || (Array.isArray(c.payments?.splits)
      ? c.payments.splits.reduce((s, x) => s + Number(x.amount || 0), 0)
      : 0);
  return Math.max(0, Math.round((Number(c.total || 0) - paid) * 100) / 100);
}

export function itemsSubtotal(items) {
  return (items || []).reduce(
    (s, i) => s + Math.max(1, Number(i.quantity || 1)) * Number(i.unitPrice || 0),
    0,
  );
}

export function payableFromForm(form) {
  const base = Number(form.itemsTotal ?? form.total ?? itemsSubtotal(form.items) ?? 0);
  const discount = Math.max(0, Number(form.discountAmount || 0));
  const tip = Math.max(0, Number(form.tipAmount || 0));
  return Math.round((base - discount + tip) * 100) / 100;
}

export function printComandaReceipt(comanda, moneyFn, businessInfo = {}) {
  if (!comanda) return;
  const items = comanda.items || [];
  const payments = comanda.payments || {};
  const meta = comanda.settlementMeta || {};
  const splits = Array.isArray(payments.splits) ? payments.splits : [];
  const bizName = businessInfo.name || businessInfo.businessName || '';
  const bizAddress = businessInfo.address || businessInfo.endereco || '';
  const logoUrl = businessInfo.logo_url || businessInfo.logoUrl || '';
  const series = comandaSeriesLabel(comanda);
  const rows = items
    .map(
      (i) =>
        `<tr><td>${i.name}</td><td>${i.itemType === 'PRODUCT' ? 'Produto' : 'Serviço'}</td><td style="text-align:right">${i.quantity}</td><td style="text-align:right">${moneyFn(i.unitPrice)}</td><td style="text-align:right">${moneyFn(i.total)}</td></tr>`,
    )
    .join('');
  const payRows = splits
    .map((s) => `<tr><td>${s.method}</td><td style="text-align:right">${moneyFn(s.amount)}</td></tr>`)
    .join('');
  const w = window.open('', '_blank', 'noopener,noreferrer,width=480,height=720');
  if (!w) {
    alert('Permita pop-ups para imprimir o recibo.');
    return;
  }
  w.document.write(`<!doctype html><html><head><title>Recibo ${series}</title>
    <style>
      body{font-family:system-ui,sans-serif;padding:24px;color:#111}
      h1{font-size:1.1rem;margin:0 0 4px}
      .biz{font-size:0.95rem;font-weight:700;margin:0 0 2px}
      .addr{font-size:0.8rem;color:#555;margin:0 0 10px}
      img.logo{max-height:48px;margin-bottom:8px}
      p{margin:2px 0;font-size:0.9rem}
      table{width:100%;border-collapse:collapse;margin-top:12px;font-size:0.85rem}
      th,td{border-bottom:1px solid #ddd;padding:6px 4px;text-align:left}
      th{font-size:0.75rem;text-transform:uppercase;color:#555}
      .tot{margin-top:12px;font-weight:700}
      @media print{body{padding:0}}
    </style></head><body>
    ${logoUrl ? `<img class="logo" src="${logoUrl}" alt="" />` : ''}
    ${bizName ? `<p class="biz">${bizName}</p>` : ''}
    ${bizAddress ? `<p class="addr">${bizAddress}</p>` : ''}
    <h1>Comanda ${series}</h1>
    <p><strong>Cliente:</strong> ${comanda.customerName || '—'}</p>
    <p><strong>Status:</strong> ${comandaStatusLabel(comanda.status)}</p>
    <p><strong>Aberta:</strong> ${comanda.openedAt ? new Date(comanda.openedAt).toLocaleString('pt-BR') : '—'}</p>
    ${comanda.closedAt ? `<p><strong>Quitada:</strong> ${new Date(comanda.closedAt).toLocaleString('pt-BR')}</p>` : ''}
    <table><thead><tr><th>Item</th><th>Tipo</th><th style="text-align:right">Qtd</th><th style="text-align:right">Unit.</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="5">Sem itens</td></tr>'}</tbody></table>
    ${(payments.discountAmount || meta.discountAmount) ? `<p>Desconto: −${moneyFn(payments.discountAmount ?? meta.discountAmount)}</p>` : ''}
    ${(payments.tipAmount || meta.tipAmount) ? `<p>Gorjeta: +${moneyFn(payments.tipAmount ?? meta.tipAmount)}</p>` : ''}
    <p class="tot">Total: ${moneyFn(payments.totalCheckout ?? meta.totalCheckout ?? comanda.total)}</p>
    ${payRows ? `<table><thead><tr><th>Pagamento</th><th style="text-align:right">Valor</th></tr></thead><tbody>${payRows}</tbody></table>` : ''}
    <script>window.onload=()=>{window.print();}</script>
    </body></html>`);
  w.document.close();
}

export function ModalShell({ title, subtitle, onClose, children, wide }) {
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className={`modal-glass-panel finv2-modal ${wide ? 'finv2-modal--wide' : ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="finv2-modal__head">
          <div>
            <h3 className="finv2-modal__title">{title}</h3>
            {subtitle ? <p className="finv2-modal__sub">{subtitle}</p> : null}
          </div>
          <button type="button" className="finv2-icon-btn" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="finv2-modal__body">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children, full }) {
  return (
    <label className={`finv2-field ${full ? 'finv2-field--full' : ''}`}>
      <span className="finv2-field__label">{label}</span>
      {children}
    </label>
  );
}

export function EmptyState({ icon: Icon = Receipt, title, hint }) {
  return (
    <div className="finv2-empty">
      <div className="finv2-empty__icon">
        <Icon size={22} strokeWidth={1.75} />
      </div>
      <p className="finv2-empty__title">{title}</p>
      {hint ? <p className="finv2-empty__hint">{hint}</p> : null}
    </div>
  );
}

export function StatusPill({ tone, children }) {
  return <span className={`finv2-pill finv2-pill--${tone}`}>{children}</span>;
}

export function CollapsibleSection({ id, title, open, onToggle, children }) {
  return (
    <div className="finv2-flow-block" style={{ marginTop: 12 }}>
      <button type="button" className="finv2-flow-row" onClick={() => onToggle(id)}>
        <span>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {title}
        </span>
      </button>
      {open ? <div style={{ padding: '0 0.75rem 0.85rem' }}>{children}</div> : null}
    </div>
  );
}

export function CashCloseReport({ session, hideTotals = false }) {
  const totals = session?.totals || session?.snapshot || {};
  const byMethod = totals.byMethod || {};
  const counted = session?.countedCash ?? totals.countedCash;
  const expected = totals.expectedCash;
  const difference =
    totals.difference != null
      ? totals.difference
      : counted != null && expected != null
        ? Number(counted) - Number(expected)
        : null;

  return (
    <div className="finv2-close-report">
      {!hideTotals ? (
        <div className="finv2-cash-metrics">
          <div>
            <span>Entradas</span>
            <strong className="is-in finv2-num">{money(totals.totalIn)}</strong>
          </div>
          <div>
            <span>Saídas</span>
            <strong className="is-out finv2-num">{money(totals.totalOut)}</strong>
          </div>
          <div>
            <span>Saldo movimentos</span>
            <strong className="finv2-num">{money(totals.balance)}</strong>
          </div>
        </div>
      ) : null}
      <div className="finv2-cash-metrics" style={{ marginTop: 12 }}>
        <div>
          <span>Dinheiro esperado</span>
          <strong className="finv2-num">{money(expected)}</strong>
        </div>
        <div>
          <span>Dinheiro contado</span>
          <strong className="finv2-num">{counted != null ? money(counted) : '—'}</strong>
        </div>
        <div>
          <span>Diferença</span>
          <strong className={`finv2-num ${difference > 0 ? 'is-in' : difference < 0 ? 'is-out' : ''}`}>
            {difference != null ? money(difference) : '—'}
          </strong>
        </div>
      </div>
      {Object.keys(byMethod).length ? (
        <div className="finv2-table-wrap" style={{ marginTop: 16 }}>
          <table className="finv2-table">
            <thead>
              <tr>
                <th>Forma</th>
                <th className="is-right">Entradas</th>
                <th className="is-right">Saídas</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(byMethod).map(([method, vals]) => (
                <tr key={method}>
                  <td className="is-strong">{method}</td>
                  <td className="is-right is-in finv2-num">{money(vals.in)}</td>
                  <td className="is-right is-out finv2-num">{money(vals.out)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
