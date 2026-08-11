import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { todayIsoLocal } from '../../utils/dateLocal';

/**
 * Card/modal para abrir o caixa sem ir ao Financeiro.
 */
export default function OpenCashModal({ open, onClose, onSuccess, elevated = false }) {
  const { financeV2 } = useApp();
  const [openingFloat, setOpeningFloat] = useState('0');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setOpeningFloat('0');
    setError(null);
    setSubmitting(false);
  }, [open]);

  if (!open) return null;

  const handleClose = () => {
    if (submitting) return;
    onClose?.();
  };

  const handleSubmit = async () => {
    if (!financeV2?.openCash) return;
    setSubmitting(true);
    setError(null);
    try {
      await financeV2.openCash({
        openingFloat: Number(openingFloat || 0),
        date: todayIsoLocal(),
      });
      setOpeningFloat('0');
      await onSuccess?.();
      onClose?.();
    } catch (err) {
      setError(err.message || 'Não foi possível abrir o caixa.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className={`modal-backdrop finv2-open-cash-modal${elevated ? ' modal-backdrop--elevated' : ''}`}
      onClick={handleClose}
    >
      <div
        className="modal-glass-panel fade-in scheduler-modal-panel finv2-open-cash-modal__panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="open-cash-modal-title"
      >
        <div className="booking-reserve-form__title-row">
          <h2 id="open-cash-modal-title" className="booking-reserve-form__title">
            Abrir caixa
          </h2>
          <button
            type="button"
            className="booking-reserve-form__close"
            onClick={handleClose}
            aria-label="Fechar"
            disabled={submitting}
          >
            <X size={20} />
          </button>
        </div>

        <p className="finv2-open-cash-modal__hint">
          Quanto tem em <strong>dinheiro na gaveta</strong> agora?
        </p>

        <div className="booking-reserve-form finv2-open-cash-modal__form">
          <label
            htmlFor="open-cash-float"
            className="finv2-open-cash-modal__label"
          >
            Dinheiro na gaveta (R$)
          </label>
          <input
            id="open-cash-float"
            type="number"
            step="0.01"
            min="0"
            className="booking-reserve-form__field"
            value={openingFloat}
            onChange={(e) => setOpeningFloat(e.target.value)}
            disabled={submitting}
            placeholder="Ex: 50,00 (troco)"
            autoFocus
          />
          <p className="finv2-open-cash-modal__note">
            Usado na conferência ao fechar o caixa. Deixe <strong>0</strong> se a gaveta está vazia.
          </p>
          {error ? <p className="finv2-open-cash-modal__error">{error}</p> : null}
          <button
            type="button"
            className="btn-primary booking-reserve-form__submit"
            disabled={submitting}
            onClick={handleSubmit}
          >
            {submitting ? 'Abrindo…' : 'Abrir caixa do dia'}
          </button>
        </div>
      </div>
    </div>
  );
}
