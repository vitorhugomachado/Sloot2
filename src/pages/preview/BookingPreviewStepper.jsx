import React from 'react';

const STEPS = [
  { id: 1, label: 'Serviço' },
  { id: 2, label: 'Profissional' },
  { id: 3, label: 'Data' },
  { id: 4, label: 'Horário' },
  { id: 5, label: 'Resumo' },
];

/** Mapeia passo interno (1=serviço … 4=resumo, 5=sucesso) para o stepper visual. */
export function mapFlowStepToStepper(flowStep) {
  if (flowStep <= 1) return 1;
  if (flowStep === 2) return 2;
  if (flowStep === 3) return 3;
  if (flowStep === 4) return 5;
  return 5;
}

export default function BookingPreviewStepper({ current = 1, mutedPast = false }) {
  return (
    <nav className="bp-stepper" aria-label="Progresso do agendamento">
      <ol className="bp-stepper__list">
        {STEPS.map((s, index) => {
          const done = current > s.id;
          const active = current === s.id;
          const pastMuted = mutedPast && done && !active;
          return (
            <li key={s.id} className="bp-stepper__item">
              <div className="bp-stepper__node-wrap">
                <span
                  className={[
                    'bp-stepper__circle',
                    active && 'bp-stepper__circle--active',
                    pastMuted && 'bp-stepper__circle--past',
                    done && !active && !pastMuted && 'bp-stepper__circle--done',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {s.id}
                </span>
                <span
                  className={[
                    'bp-stepper__label',
                    active && 'bp-stepper__label--active',
                    done && !active && !pastMuted && 'bp-stepper__label--emphasis',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {s.label}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <span
                  className={[
                    'bp-stepper__line',
                    current > s.id && !mutedPast && 'bp-stepper__line--done',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
