import React from 'react';
import { Check } from 'lucide-react';
import BookingPreviewFlowLayout from './BookingPreviewFlowLayout';

export default function BookingPreviewBarberStep({
  barbers,
  selectedBarber,
  onPickBarber,
  onBack,
  onContinue,
  previewBanner,
  mobileHubStyle = false,
  businessTitle,
  businessTagline,
}) {
  const mobileHubSteps = [
    { id: 1, label: 'Serviço' },
    { id: 2, label: 'Profissional' },
    { id: 3, label: 'Data e horário' },
    { id: 4, label: 'Confirmação' },
  ];

  return (
    <BookingPreviewFlowLayout
      stepperCurrent={2}
      title={mobileHubStyle ? null : '2. Escolha o profissional'}
      previewBanner={previewBanner}
      showBack={mobileHubStyle || Boolean(onBack)}
      onBack={onBack}
      onContinue={onContinue}
      continueDisabled={!selectedBarber}
      selectionId={selectedBarber?.id}
      brandTitle={mobileHubStyle ? businessTitle : null}
      brandTagline={mobileHubStyle ? businessTagline : null}
      introTitle={mobileHubStyle ? 'Escolha o profissional' : null}
      introSubtitle={mobileHubStyle ? 'Selecione quem vai te atender.' : null}
      stepperSteps={mobileHubStyle ? mobileHubSteps : undefined}
      stepperDoneWithCheck={mobileHubStyle}
    >
      {barbers.length === 0 ? (
        <p className="bp-empty">Nenhum profissional disponivel para agendamento online.</p>
      ) : (
        barbers.map((b) => {
          const selected = selectedBarber?.id === b.id;
          const role = b.role === 'Gerente' ? 'Especialista' : 'Barbeiro';
          const description = String(b.bio || '').trim()
            || (role === 'Especialista' ? 'Atendimento premium' : 'Atendimento personalizado');
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
                <span className="bp-pro-card__role">{role}</span>
                <span className="bp-pro-card__desc">{description}</span>
              </div>
              <button
                type="button"
                className={`bp-btn-select${selected ? ' bp-btn-select--active' : ''}`}
                onClick={() => onPickBarber(b)}
                aria-label={selected ? `${b.name} selecionado` : `Selecionar ${b.name}`}
              >
                <span className="bp-btn-select__label">Selecionar</span>
                <span className="bp-btn-select__indicator" aria-hidden>
                  {selected ? <Check size={16} strokeWidth={2.5} /> : null}
                </span>
              </button>
            </div>
          );
        })
      )}
    </BookingPreviewFlowLayout>
  );
}
