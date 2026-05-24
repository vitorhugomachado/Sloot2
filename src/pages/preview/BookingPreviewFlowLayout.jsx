import React, { useEffect } from 'react';
import { scrollToContinueButton } from '../../hooks/usePublicBookingFlow';
import BookingPreviewStepper from './BookingPreviewStepper';

export default function BookingPreviewFlowLayout({
  stepperCurrent,
  title,
  previewBanner,
  children,
  onBack,
  onContinue,
  continueDisabled = false,
  continueLabel = 'Continuar',
  showBack = true,
  selectionId,
}) {
  useEffect(() => {
    if (selectionId == null) return;
    scrollToContinueButton();
  }, [selectionId]);
  return (
    <div className="bp-flow">
      {previewBanner}
      <header className="bp-flow__header bp-flow__header--compact">
        <BookingPreviewStepper current={stepperCurrent} />
        {title ? <h2 className="bp-section-title">{title}</h2> : null}
      </header>
      <div className="bp-flow__scroll">{children}</div>
      <footer className={`bp-flow__footer${showBack ? ' bp-flow__footer--dual' : ''}`}>
        {showBack ? (
          <button type="button" className="bp-btn-outline" onClick={onBack}>
            Voltar
          </button>
        ) : null}
        <button
          type="button"
          className="bp-btn-continuar"
          disabled={continueDisabled}
          onClick={onContinue}
        >
          {continueLabel}
        </button>
      </footer>
    </div>
  );
}
