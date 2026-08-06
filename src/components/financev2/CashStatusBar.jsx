import React from 'react';
import { Wallet } from 'lucide-react';
import { money } from './shared';

function openedTimeLabel(value) {
  if (!value) return '';
  try {
    const d = new Date(value);
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (sameDay) return time;
    return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${time}`;
  } catch {
    return '';
  }
}

export default function CashStatusBar({ cash, isGerente, onOpenCash, onAdjust, onCloseCash }) {
  const totals = cash?.totals || {};
  return (
    <section className={`finv2-cashbar ${cash ? 'is-open' : 'is-closed'}`}>
      <div className="finv2-cashbar__status">
        <span className="finv2-cashbar__icon">
          <Wallet size={17} strokeWidth={2} />
        </span>
        {cash ? (
          <span className="finv2-cashbar__text">
            Caixa aberto por <strong>{cash.openedByName || 'equipe'}</strong>
            {' às '}
            {openedTimeLabel(cash.openedAt)}
          </span>
        ) : (
          <span className="finv2-cashbar__text">Caixa fechado</span>
        )}
      </div>

      {cash ? (
        <div className="finv2-cashbar__chips">
          <span className="finv2-cashbar__chip">
            Entradas <strong className="is-in finv2-num">+{money(totals.totalIn)}</strong>
          </span>
          <span className="finv2-cashbar__chip">
            Saídas <strong className="is-out finv2-num">−{money(totals.totalOut)}</strong>
          </span>
          <span className="finv2-cashbar__chip finv2-cashbar__chip--balance">
            Saldo <strong className="finv2-num">{money(totals.balance)}</strong>
          </span>
        </div>
      ) : null}

      {isGerente ? (
        <div className="finv2-cashbar__actions">
          {!cash ? (
            <button type="button" className="btn-primary finv2-btn-primary finv2-btn-sm" onClick={onOpenCash}>
              Abrir caixa
            </button>
          ) : (
            <>
              <button type="button" className="finv2-btn finv2-btn-sm" onClick={onAdjust}>
                Sangria/Suprimento
              </button>
              <button
                type="button"
                className="finv2-btn finv2-btn-sm finv2-btn--ghost-danger"
                onClick={onCloseCash}
              >
                Fechar caixa
              </button>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
