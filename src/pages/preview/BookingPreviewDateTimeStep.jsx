import React, { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Info } from 'lucide-react';
import BookingPreviewFlowLayout from './BookingPreviewFlowLayout';

function formatDateChip(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const weekday = date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  const cap = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  const month = date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  const monthCap = month.charAt(0).toUpperCase() + month.slice(1);
  return { weekday: cap, day: String(d), month: monthCap };
}

function formatMonthLabel(iso) {
  if (!iso) return '';
  const [y, m] = iso.split('-').map(Number);
  const month = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long' });
  return `${month.charAt(0).toUpperCase() + month.slice(1)} ${y}`;
}

export default function BookingPreviewDateTimeStep({
  workingDayIsos,
  selectedBarber,
  selectedDate,
  selectedTime,
  onPickDate,
  onPickTime,
  onBack,
  onContinue,
  getSlotsForDay,
  previewBanner,
  mobileHubStyle = false,
  businessTitle,
  businessTagline,
}) {
  const needsBarber = !selectedBarber;
  const carouselRef = useRef(null);

  const scrollCarousel = (dir) => {
    const el = carouselRef.current;
    if (!el) return;
    const step = Math.max(el.clientWidth * 0.65, 140);
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  };

  const { slotsToDisplay, isWithinAnyShift, taken } = selectedDate
    ? getSlotsForDay(selectedDate)
    : { slotsToDisplay: [], isWithinAnyShift: () => false, taken: new Set() };

  const stepperCurrent = mobileHubStyle ? 3 : (selectedTime ? 4 : 3);
  const mobileHubSteps = [
    { id: 1, label: 'Serviço' },
    { id: 2, label: 'Profissional' },
    { id: 3, label: 'Data e horário' },
    { id: 4, label: 'Confirmação' },
  ];
  const timeSectionRef = useRef(null);

  useEffect(() => {
    if (!selectedDate || selectedTime) return;
    const node = timeSectionRef.current;
    if (!node || node.closest('.lt-phone__embed')) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [selectedDate, selectedTime]);

  return (
    <BookingPreviewFlowLayout
      stepperCurrent={stepperCurrent}
      previewBanner={previewBanner}
      showBack={mobileHubStyle || Boolean(onBack)}
      onBack={onBack}
      onContinue={onContinue}
      continueDisabled={!selectedDate || !selectedTime}
      selectionId={selectedTime ? `${selectedDate}|${selectedTime}` : selectedDate}
      brandTitle={mobileHubStyle ? businessTitle : null}
      brandTagline={mobileHubStyle ? businessTagline : null}
      introTitle={mobileHubStyle ? 'Escolha a data e horário' : null}
      introSubtitle={mobileHubStyle ? 'Selecione o melhor horário para você.' : null}
      stepperSteps={mobileHubStyle ? mobileHubSteps : undefined}
      stepperDoneWithCheck={mobileHubStyle}
    >
      {mobileHubStyle ? <div className="bp-date-month-label">{formatMonthLabel(selectedDate)}</div> : null}

      <div className="bp-date-carousel-wrap">
        <button
          type="button"
          className="bp-carousel-nav bp-carousel-nav--prev"
          onClick={() => scrollCarousel(-1)}
          aria-label="Ver datas anteriores"
        >
          <ChevronLeft size={22} strokeWidth={2.75} color="#ffffff" aria-hidden />
        </button>
        <div className="bp-date-carousel-track">
        <div ref={carouselRef} className="bp-date-carousel">
          {needsBarber ? (
            <p className="bp-empty bp-empty--inline">Selecione seu profissional</p>
          ) : workingDayIsos.length === 0 ? (
            <p className="bp-empty bp-empty--inline">Sem dias com expediente.</p>
          ) : (
            workingDayIsos.map((iso) => {
              const chip = formatDateChip(iso);
              const selected = selectedDate === iso;
              return (
                <button
                  key={iso}
                  type="button"
                  className={`bp-date-chip${selected ? ' bp-date-chip--selected' : ''}`}
                  onClick={() => onPickDate(iso)}
                >
                  <span className="bp-date-chip__wd">{chip.weekday}</span>
                  <span className="bp-date-chip__day">{chip.day}</span>
                  <span className="bp-date-chip__mo">{chip.month}</span>
                </button>
              );
            })
          )}
        </div>
        </div>
        <button
          type="button"
          className="bp-carousel-nav bp-carousel-nav--next"
          onClick={() => scrollCarousel(1)}
          aria-label="Ver proximas datas"
        >
          <ChevronRight size={22} strokeWidth={2.75} color="#ffffff" aria-hidden />
        </button>
      </div>

      <h2
        ref={timeSectionRef}
        className="bp-section-title bp-section-title--inline bp-section-title--spaced"
      >
        {mobileHubStyle ? 'Horários disponíveis' : '4. Escolha o horário'}
      </h2>

      {needsBarber ? (
        <p className="bp-empty bp-empty--inline">Selecione seu profissional</p>
      ) : !selectedDate ? (
        <p className="bp-empty bp-empty--inline">Selecione uma data acima.</p>
      ) : slotsToDisplay.length === 0 ? (
        <p className="bp-empty bp-empty--inline">Nenhum horario neste dia.</p>
      ) : (
        <div className="bp-time-grid">
          {slotsToDisplay.map((t) => {
            const ok = isWithinAnyShift(t) && !taken.has(t);
            const selected = selectedTime === t;
            return (
              <button
                key={t}
                type="button"
                className={[
                  'bp-time-slot',
                  ok && 'bp-time-slot--ok',
                  selected && 'bp-time-slot--selected',
                ]
                  .filter(Boolean)
                  .join(' ')}
                disabled={!ok}
                onClick={() => ok && onPickTime(t)}
              >
                {t}
              </button>
            );
          })}
        </div>
      )}

      {selectedDate && !selectedTime && (
        <p className="bp-continue-hint">Selecione um horário para ativar o botão Continuar.</p>
      )}

      {mobileHubStyle ? (
        <div className="bp-time-info">
          <Info size={15} strokeWidth={1.8} aria-hidden />
          <span>Os horários são exibidos no<br />horário local da barbearia.</span>
        </div>
      ) : null}
    </BookingPreviewFlowLayout>
  );
}
