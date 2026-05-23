import React, { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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

  const stepperCurrent = selectedTime ? 4 : 3;
  const timeSectionRef = useRef(null);

  useEffect(() => {
    if (!selectedDate || selectedTime) return;
    timeSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [selectedDate, selectedTime]);

  return (
    <BookingPreviewFlowLayout
      stepperCurrent={stepperCurrent}
      previewBanner={previewBanner}
      onBack={onBack}
      onContinue={onContinue}
      continueDisabled={!selectedDate || !selectedTime}
      selectionId={selectedTime ? `${selectedDate}|${selectedTime}` : selectedDate}
    >
      <h2 className="bp-section-title bp-section-title--inline">3. Escolha a data</h2>

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
        4. Escolha o horário
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
    </BookingPreviewFlowLayout>
  );
}
