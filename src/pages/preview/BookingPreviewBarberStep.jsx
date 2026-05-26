import React from 'react';
import BookingPreviewFlowLayout from './BookingPreviewFlowLayout';

export default function BookingPreviewBarberStep({
  barbers,
  selectedBarber,
  onPickBarber,
  onBack,
  onContinue,
  previewBanner,
}) {
  return (
    <BookingPreviewFlowLayout
      stepperCurrent={2}
      title="2. Escolha o profissional"
      previewBanner={previewBanner}
      onBack={onBack}
      onContinue={onContinue}
      continueDisabled={!selectedBarber}
      selectionId={selectedBarber?.id}
    >
      {barbers.length === 0 ? (
        <p className="bp-empty">Nenhum profissional disponivel para agendamento online.</p>
      ) : (
        barbers.map((b) => {
          const selected = selectedBarber?.id === b.id;
          return (
            <div key={b.id} className={`bp-pro-card${selected ? ' bp-pro-card--selected' : ''}`}>
              <div className="bp-pro-card__avatar">
                {b.foto_perfil ? (
                  <img src={b.foto_perfil} alt="" />
                ) : (
                  <span>{b.name.charAt(0)}</span>
                )}
              </div>
              <div className="bp-pro-card__body">
                <span className="bp-pro-card__name">{b.name}</span>
              </div>
              <button
                type="button"
                className={`bp-btn-select${selected ? ' bp-btn-select--active' : ''}`}
                onClick={() => onPickBarber(b)}
              >
                Selecionar
              </button>
            </div>
          );
        })
      )}
    </BookingPreviewFlowLayout>
  );
}
