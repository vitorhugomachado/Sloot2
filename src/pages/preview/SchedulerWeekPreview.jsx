import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X, Clock, User, Scissors, CalendarDays, Plus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getBarberColor, getBarberInitials, getBarberShortName } from '../../utils/barberDisplay';
import { normalizePhoneForWhatsApp, openWhatsAppConfirm } from '../../utils/appointmentWhatsApp';
import { getStaffBookingFormError } from '../../utils/staffBookingForm';
import { STAFF_SCHEDULER_TIME_SLOTS } from '../../utils/publicBookingSlots';
import { parseDurationMinutes } from '../../utils/barberAvailability';
import { filterAvailableBookingTimes, isBookingSlotTaken } from '../../utils/bookingAvailability';
import WhatsAppIcon from '../../components/icons/WhatsAppIcon';
import AppointmentActionModal from '../../components/appointments/AppointmentActionModal';
import { useAppointmentActions } from '../../hooks/useAppointmentActions';
import { toIsoLocal } from '../../utils/dateLocal';
import './scheduler-week-preview.css';

const HOUR_START = 8;
const HOUR_END = 21;
const PX_PER_MINUTE = 60 / 60; // 60px por hora
const DAY_NAMES_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const DAY_NAMES_MINI = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const MOCK_BARBERS_FALLBACK = [
  { id: 1, name: 'Carlos', foto_perfil: null },
  { id: 2, name: 'Rafael', foto_perfil: null },
  { id: 3, name: 'Diego', foto_perfil: null },
];

function BarberTeamAvatar({ barber, activeBarbers, active, onClick }) {
  const accent = getBarberColor(barber.id, activeBarbers);
  return (
    <button
      type="button"
      className={`swp-team__avatar ${active ? 'swp-team__avatar--active' : ''}`}
      style={{ ['--swp-avatar']: accent }}
      onClick={onClick}
      title={barber.name}
    >
      {barber.foto_perfil ? (
        <img src={barber.foto_perfil} alt={barber.name} />
      ) : (
        <span className="swp-team__avatar-initials">{getBarberInitials(barber.name)}</span>
      )}
    </button>
  );
}

/** Resolve barberId mock (1|2|3) para IDs reais do tenant. */
function resolveMockBarberId(slot, activeBarbers) {
  if (!activeBarbers.length) return slot;
  const idx = (slot - 1) % activeBarbers.length;
  return activeBarbers[idx].id;
}

/**
 * Cores por situação do atendimento:
 * - Agendado: confirmação ainda não enviada (branco/cinza)
 * - Confirmado: cliente confirmou após WhatsApp (verde)
 * - Em progresso: em atendimento (azul)
 * - Cancelado: vermelho
 */
const STATUS_STYLES = {
  Agendado: {
    accent: '#9CA3AF',
    soft: '#FFFFFF',
    border: '#E5E7EB',
    label: 'Sem confirmação',
    legend: 'Sem confirmação',
  },
  Confirmado: {
    accent: '#059669',
    soft: '#ECFDF5',
    border: '#A7F3D0',
    label: 'Confirmado',
    legend: 'Confirmado (WhatsApp)',
  },
  'Em progresso': {
    accent: '#2563EB',
    soft: '#EFF6FF',
    border: '#BFDBFE',
    label: 'Em atendimento',
    legend: 'Em atendimento',
  },
  Finalizado: {
    accent: '#047857',
    soft: '#F0FDF4',
    border: '#BBF7D0',
    label: 'Finalizado',
    legend: 'Finalizado',
  },
  Cancelado: {
    accent: '#DC2626',
    soft: '#FEF2F2',
    border: '#FECACA',
    label: 'Cancelado',
    legend: 'Cancelado',
  },
};

const LEGEND_ITEMS = [
  STATUS_STYLES.Agendado,
  STATUS_STYLES.Confirmado,
  STATUS_STYLES['Em progresso'],
  STATUS_STYLES.Cancelado,
];

function statusStyle(status) {
  const s = String(status || '').trim();
  if (s === 'Em atendimento') return STATUS_STYLES['Em progresso'];
  return STATUS_STYLES[s] || STATUS_STYLES.Agendado;
}

function StatusLegend() {
  return (
    <div className="swp-legend" aria-label="Legenda de status">
      {LEGEND_ITEMS.map((item) => (
        <span key={item.legend} className="swp-legend__item">
          <span
            className="swp-legend__swatch"
            style={{
              background: item.soft,
              borderColor: item.border,
              ['--swp-legend-accent']: item.accent,
            }}
          />
          {item.legend}
        </span>
      ))}
    </div>
  );
}

/** Gera agendamentos mock relativos à semana da data de referência. */
function buildMockAppointments(anchorDate, activeBarbers = MOCK_BARBERS_FALLBACK) {
  const monday = startOfWeek(anchorDate);
  const b = (slot) => resolveMockBarberId(slot, activeBarbers);
  const d = (offset, time, durationMin, extra) => {
    const day = addDays(monday, offset);
    return {
      id: `${toIsoLocal(day)}-${time}-${extra.customer}`,
      date: toIsoLocal(day),
      time,
      durationMinutes: durationMin,
      ...extra,
    };
  };

  return [
    d(0, '09:00', 45, { customer: 'João Silva', service: 'Corte + Barba', barberId: b(1), status: 'Confirmado', price: 70, phone: '11987654321' }),
    d(0, '10:00', 30, { customer: 'Pedro Lima', service: 'Corte', barberId: b(2), status: 'Agendado', price: 45, phone: '11976543210' }),
    d(0, '14:30', 60, { customer: 'Marcos Souza', service: 'Barba premium', barberId: b(1), status: 'Agendado', price: 55, phone: '11965432109' }),
    d(1, '09:30', 30, { customer: 'Lucas Alves', service: 'Corte', barberId: b(3), status: 'Em progresso', price: 45, phone: '11954321098' }),
    d(1, '11:00', 45, { customer: 'Bruno Costa', service: 'Corte + Barba', barberId: b(2), status: 'Confirmado', price: 70, phone: '11943210987' }),
    d(1, '15:00', 30, { customer: 'André Nunes', service: 'Sobrancelha', barberId: b(1), status: 'Agendado', price: 25, phone: '11932109876' }),
    d(2, '10:00', 90, { customer: 'Felipe Rocha', service: 'Combo completo', barberId: b(2), status: 'Agendado', price: 95, phone: '11921098765' }),
    d(2, '13:00', 30, { customer: 'Thiago Dias', service: 'Corte', barberId: b(3), status: 'Finalizado', price: 45, phone: '11910987654' }),
    d(3, '08:30', 45, { customer: 'Gabriel Pinto', service: 'Corte + Barba', barberId: b(1), status: 'Confirmado', price: 70, phone: '11999887766' }),
    d(3, '16:00', 30, { customer: 'Ricardo Melo', service: 'Barba', barberId: b(3), status: 'Agendado', price: 35, phone: '11988776655' }),
    d(3, '16:30', 45, { customer: 'Henrique Paz', service: 'Corte', barberId: b(2), status: 'Agendado', price: 45, phone: '11977665544' }),
    d(4, '09:00', 30, { customer: 'Igor Santos', service: 'Corte', barberId: b(1), status: 'Finalizado', price: 45, phone: '11966554433' }),
    d(4, '11:30', 60, { customer: 'Mateus Freitas', service: 'Corte + Barba', barberId: b(2), status: 'Confirmado', price: 70, phone: '11955443322' }),
    d(5, '10:00', 45, { customer: 'Caio Borges', service: 'Corte', barberId: b(3), status: 'Agendado', price: 45, phone: '11944332211' }),
    d(5, '14:00', 30, { customer: 'Vitor Ramos', service: 'Barba', barberId: b(1), status: 'Agendado', price: 35, phone: '11933221100' }),
    d(6, '11:00', 30, { customer: 'Renato Dias', service: 'Corte', barberId: b(2), status: 'Cancelado', price: 45, phone: '11922110099' }),
  ];
}

function startOfWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d;
}

function addDays(date, n) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + n);
  return d;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function parseTimeToMinutes(hhmm) {
  const m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})/);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

function endTimeLabel(time, durationMinutes) {
  const end = parseTimeToMinutes(time) + durationMinutes;
  return `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
}

function formatWeekRange(monday) {
  const sunday = addDays(monday, 6);
  const mMon = MONTH_NAMES[monday.getMonth()].slice(0, 3);
  const mSun = MONTH_NAMES[sunday.getMonth()].slice(0, 3);
  if (monday.getMonth() === sunday.getMonth()) {
    return `${monday.getDate()} – ${sunday.getDate()} de ${MONTH_NAMES[monday.getMonth()]}`;
  }
  return `${monday.getDate()} ${mMon} – ${sunday.getDate()} ${mSun}`;
}

function formatSelectedLabel(date) {
  const weekday = DAY_NAMES_SHORT[(date.getDay() + 6) % 7];
  return `${weekday}, ${date.getDate()} de ${MONTH_NAMES[date.getMonth()]}`;
}

function buildMonthGrid(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const first = new Date(year, month, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startPad; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, month, day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function hoursList() {
  const list = [];
  for (let h = HOUR_START; h <= HOUR_END; h += 1) {
    list.push(`${String(h).padStart(2, '0')}:00`);
  }
  return list;
}

const GRID_HEIGHT = (HOUR_END - HOUR_START) * 60 * PX_PER_MINUTE;

/* —— Sidebar: calendário mensal —— */

function MonthCalendar({ viewMonth, onViewMonthChange, selectedDate, weekStart, onSelectDate, busyDates }) {
  const cells = useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);
  const weekEnd = addDays(weekStart, 6);
  const today = new Date();

  return (
    <section className="swp-cal" aria-label="Seletor de datas">
      <div className="swp-cal__nav">
        <span className="swp-cal__month">
          {MONTH_NAMES[viewMonth.getMonth()]} <em>{viewMonth.getFullYear()}</em>
        </span>
        <div className="swp-cal__nav-btns">
          <button
            type="button"
            className="swp-icon-btn swp-icon-btn--sm"
            aria-label="Mês anterior"
            onClick={() => onViewMonthChange(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
          >
            <ChevronLeft size={15} />
          </button>
          <button
            type="button"
            className="swp-icon-btn swp-icon-btn--sm"
            aria-label="Próximo mês"
            onClick={() => onViewMonthChange(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      <div className="swp-cal__weekdays">
        {DAY_NAMES_MINI.map((label, i) => (
          <span key={`${label}-${i}`}>{label}</span>
        ))}
      </div>

      <div className="swp-cal__grid">
        {cells.map((day, idx) => {
          if (!day) {
            return <span key={`empty-${idx}`} className="swp-cal__cell swp-cal__cell--empty" />;
          }
          const iso = toIsoLocal(day);
          const isSelected = sameDay(day, selectedDate);
          const isToday = sameDay(day, today);
          const inWeek = day >= weekStart && day <= weekEnd;
          return (
            <button
              key={iso}
              type="button"
              className={[
                'swp-cal__cell',
                inWeek ? 'swp-cal__cell--in-week' : '',
                isToday ? 'swp-cal__cell--today' : '',
                isSelected ? 'swp-cal__cell--selected' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => onSelectDate(day)}
            >
              <span className="swp-cal__num">{day.getDate()}</span>
              {busyDates.has(iso) ? <span className="swp-cal__dot" aria-hidden /> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* —— Sidebar: resumo do dia selecionado —— */

function DaySummary({ selectedDate, appointments, barberById, onSelect }) {
  const iso = toIsoLocal(selectedDate);
  const dayAppts = useMemo(
    () => appointments
      .filter((a) => a.date === iso)
      .sort((a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time)),
    [appointments, iso]
  );

  return (
    <section className="swp-summary">
      <h3 className="swp-summary__title">{formatSelectedLabel(selectedDate)}</h3>
      {dayAppts.length === 0 ? (
        <p className="swp-summary__empty">Sem atendimentos neste dia.</p>
      ) : (
        <ul className="swp-summary__list">
          {dayAppts.map((appt) => {
            const st = statusStyle(appt.status);
            return (
              <li key={appt.id}>
                <button type="button" className="swp-summary__item" onClick={() => onSelect(appt)}>
                  <span className="swp-summary__time">{appt.time}</span>
                  <span className="swp-summary__bar" style={{ background: st.accent }} aria-hidden />
                  <span className="swp-summary__info">
                    <span className="swp-summary__customer">{appt.customer}</span>
                    <span className="swp-summary__service">
                      {appt.time}–{endTimeLabel(appt.time, appt.durationMinutes)} · {barberById[appt.barberId]?.name || '—'}
                    </span>
                    <span className="swp-summary__service-detail">{appt.service}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* —— Bloco na grade —— */

function AppointmentBlock({ appt, barberName, lane, laneCount, onSelect }) {
  const startMin = parseTimeToMinutes(appt.time);
  const top = (startMin - HOUR_START * 60) * PX_PER_MINUTE;
  const height = Math.max(appt.durationMinutes * PX_PER_MINUTE, 26);
  const st = statusStyle(appt.status);
  const widthPct = 100 / laneCount;
  const leftPct = lane * widthPct;
  const compact = height < 44;
  const isCancelled = appt.status === 'Cancelado';
  const barberLabel = getBarberShortName(barberName) || barberName || '—';
  const timeLabel = `${appt.time}–${endTimeLabel(appt.time, appt.durationMinutes)}`;
  const scheduleLabel = `${timeLabel} · ${barberLabel}`;
  const showService = height >= 52;

  return (
    <button
      type="button"
      className={[
        'swp-block',
        compact ? 'swp-block--compact' : '',
        isCancelled ? 'swp-block--cancelled' : '',
      ].filter(Boolean).join(' ')}
      style={{
        top,
        height,
        left: `calc(${leftPct}% + 3px)`,
        width: `calc(${widthPct}% - 6px)`,
        background: st.soft,
        borderColor: st.border,
        ['--swp-accent-block']: st.accent,
      }}
      onClick={() => onSelect(appt)}
      title={`${scheduleLabel} · ${appt.customer} · ${appt.service}`}
    >
      <span className="swp-block__title">{appt.customer}</span>
      <span className="swp-block__meta">{scheduleLabel}</span>
      {showService && <span className="swp-block__service">{appt.service}</span>}
    </button>
  );
}

/** Atribui lanes a agendamentos sobrepostos no mesmo dia. */
function layoutDayColumns(dayAppts) {
  const sorted = [...dayAppts].sort(
    (a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time)
      || b.durationMinutes - a.durationMinutes
  );
  const laneEnds = [];
  const placed = [];

  sorted.forEach((appt) => {
    const start = parseTimeToMinutes(appt.time);
    const end = start + appt.durationMinutes;
    let lane = laneEnds.findIndex((e) => e <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    placed.push({ appt, lane });
  });

  const laneCount = Math.max(laneEnds.length, 1);
  return placed.map((p) => ({ ...p, laneCount }));
}

const EMPTY_MANUAL_FORM = {
  customer: '',
  phone: '',
  serviceId: '',
  barberId: '',
  date: '',
  time: '',
};

/* —— Modal: agendar manualmente —— */

function AddManualModal({
  open,
  onClose,
  onSave,
  services,
  activeBarbers,
  appointments,
  defaultDate,
  defaultBarberId,
}) {
  const [form, setForm] = useState(EMPTY_MANUAL_FORM);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setForm({
      customer: '',
      phone: '',
      serviceId: services[0]?.id ? String(services[0].id) : '',
      barberId: defaultBarberId || (activeBarbers[0]?.id ? String(activeBarbers[0].id) : ''),
      date: defaultDate,
      time: '09:00',
    });
    setError(null);
  }, [open, services, activeBarbers, defaultDate, defaultBarberId]);

  const durationMinutes = useMemo(() => {
    const svc = services.find((s) => String(s.id) === String(form.serviceId));
    return parseDurationMinutes(svc?.duration);
  }, [services, form.serviceId]);

  const selectedBarber = useMemo(
    () => activeBarbers.find((b) => String(b.id) === String(form.barberId)) || null,
    [activeBarbers, form.barberId]
  );

  const slotAvailabilityOpts = useMemo(
    () => ({ barber: selectedBarber, durationMinutes, services }),
    [selectedBarber, durationMinutes, services]
  );

  const availableTimes = useMemo(() => {
    if (!form.barberId || !form.date) return [];
    return filterAvailableBookingTimes(
      STAFF_SCHEDULER_TIME_SLOTS,
      appointments,
      form.date,
      form.barberId,
      slotAvailabilityOpts
    );
  }, [appointments, form.date, form.barberId, slotAvailabilityOpts]);

  useEffect(() => {
    if (!open) return;
    setForm((prev) => {
      if (availableTimes.length === 0) {
        return prev.time === '' ? prev : { ...prev, time: '' };
      }
      if (availableTimes.includes(prev.time)) return prev;
      return { ...prev, time: availableTimes[0] };
    });
  }, [open, availableTimes]);

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const validationError = getStaffBookingFormError({
      customer: form.customer,
      phone: form.phone,
      serviceId: form.serviceId,
      barberId: form.barberId,
      time: form.time,
      availableTimes,
    });
    if (validationError) {
      setError(validationError);
      return;
    }
    if (isBookingSlotTaken(appointments, form.date, form.time, form.barberId, {
      durationMinutes,
      services,
    })) {
      setError('Este horário já está reservado para o profissional selecionado.');
      return;
    }
    const selectedService = services.find((s) => String(s.id) === String(form.serviceId));
    onSave({
      id: `manual-${Date.now()}`,
      isManual: true,
      customer: form.customer.trim(),
      phone: form.phone.trim(),
      service: selectedService?.name || 'Serviço',
      barberId: Number(form.barberId),
      date: form.date,
      time: form.time,
      durationMinutes,
      status: 'Agendado',
      price: Number(selectedService?.price) || 0,
    });
  };

  return (
    <div className="swp-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="swp-modal"
        role="dialog"
        aria-label="Agendar atendimento"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="swp-modal__head">
          <h2 className="swp-modal__title">Agendar atendimento</h2>
          <button type="button" className="swp-icon-btn" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <form className="swp-modal__form" onSubmit={handleSubmit}>
          <label className="swp-modal__field">
            <span>Nome do cliente *</span>
            <input
              type="text"
              autoComplete="name"
              value={form.customer}
              onChange={(ev) => {
                setError(null);
                setForm((prev) => ({ ...prev, customer: ev.target.value }));
              }}
              placeholder="Ex.: João Silva"
            />
          </label>

          <label className="swp-modal__field">
            <span>Telefone (WhatsApp) *</span>
            <input
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              value={form.phone}
              onChange={(ev) => {
                setError(null);
                setForm((prev) => ({ ...prev, phone: ev.target.value }));
              }}
              placeholder="(11) 99999-9999"
            />
          </label>

          <label className="swp-modal__field">
            <span>Serviço *</span>
            <select
              value={form.serviceId}
              onChange={(ev) => {
                setError(null);
                setForm((prev) => ({ ...prev, serviceId: ev.target.value }));
              }}
            >
              <option value="">Selecione…</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — R$ {Number(s.price).toFixed(2)}
                </option>
              ))}
            </select>
          </label>

          <label className="swp-modal__field">
            <span>Profissional *</span>
            <select
              value={form.barberId}
              onChange={(ev) => {
                setError(null);
                setForm((prev) => ({ ...prev, barberId: ev.target.value }));
              }}
            >
              <option value="">Selecione…</option>
              {activeBarbers.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </label>

          <div className="swp-modal__row">
            <label className="swp-modal__field">
              <span>Data *</span>
              <input
                type="date"
                lang="pt-BR"
                value={form.date}
                onChange={(ev) => {
                  setError(null);
                  setForm((prev) => ({ ...prev, date: ev.target.value }));
                }}
              />
            </label>

            <label className="swp-modal__field">
              <span>Horário *</span>
              <select
                value={availableTimes.length === 0 ? '' : form.time}
                onChange={(ev) => {
                  setError(null);
                  setForm((prev) => ({ ...prev, time: ev.target.value }));
                }}
                disabled={availableTimes.length === 0}
              >
                {availableTimes.length === 0 ? (
                  <option value="">Sem horários livres</option>
                ) : (
                  availableTimes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))
                )}
              </select>
            </label>
          </div>

          {error ? <p className="swp-modal__error">{error}</p> : null}

          <div className="swp-modal__actions">
            <button type="button" className="swp-drawer__btn swp-drawer__btn--ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="swp-drawer__btn swp-drawer__btn--primary">
              <Plus size={16} />
              Confirmar agendamento
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


/* —— Drawer de detalhe —— */

function DetailDrawer({ appt, barberName, onClose, onCancelClick, onStartClick, onFinishClick }) {
  if (!appt) return null;
  const st = statusStyle(appt.status);
  const isCancelled = appt.status === 'Cancelado';
  const isFinished = appt.status === 'Finalizado';
  const isInProgress = appt.status === 'Em progresso' || appt.status === 'Em atendimento';
  const canStart = ['Agendado', 'Confirmado'].includes(appt.status);
  const canFinish = isInProgress;
  const canCancel = !isCancelled && !isFinished;
  const waPhone = normalizePhoneForWhatsApp(appt.phone);
  const canWhatsApp = Boolean(waPhone) && !isCancelled && !isFinished;

  const handleCancel = () => {
    if (!canCancel) return;
    onCancelClick(appt);
  };

  const handleStart = () => {
    if (!canStart) return;
    onStartClick(appt);
  };

  const handleFinish = () => {
    if (!canFinish) return;
    onFinishClick(appt);
  };

  const handleWhatsApp = () => {
    openWhatsAppConfirm(appt);
  };

  return (
    <div className="swp-drawer-backdrop" onClick={onClose} role="presentation">
      <aside
        className="swp-drawer"
        role="dialog"
        aria-label="Detalhe do atendimento"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="swp-drawer__head">
          <div>
            <span className="swp-drawer__badge" style={{ background: st.soft, color: st.accent, border: `1px solid ${st.border}` }}>
              {st.label}
            </span>
            <h3 className="swp-drawer__title">{appt.customer}</h3>
          </div>
          <button type="button" className="swp-icon-btn" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <ul className="swp-drawer__list">
          <li><Scissors size={16} /><span>{appt.service}</span></li>
          <li><User size={16} /><span>{barberName}</span></li>
          <li>
            <Clock size={16} />
            <span>
              {appt.date.split('-').reverse().join('/')} · {appt.time}–{endTimeLabel(appt.time, appt.durationMinutes)}
            </span>
          </li>
        </ul>

        <div className="swp-drawer__price-card">
          <span>Valor</span>
          <strong>R$ {Number(appt.price).toFixed(2)}</strong>
        </div>

        <div className="swp-drawer__actions">
          {isCancelled ? (
            <p className="swp-drawer__status-msg swp-drawer__status-msg--cancelled">
              Este atendimento foi cancelado.
            </p>
          ) : isFinished ? (
            <p className="swp-drawer__status-msg">Atendimento finalizado.</p>
          ) : (
            <>
              <button
                type="button"
                className="swp-drawer__btn swp-drawer__btn--ghost"
                onClick={handleStart}
                disabled={!canStart}
              >
                {isInProgress ? 'Em atendimento' : 'Iniciar atendimento'}
              </button>
              {canWhatsApp ? (
                <button
                  type="button"
                  className="swp-drawer__btn swp-drawer__btn--whatsapp"
                  onClick={handleWhatsApp}
                  title="Confirmar horário por WhatsApp"
                  aria-label={`Confirmar horário com ${appt.customer} por WhatsApp`}
                >
                  <WhatsAppIcon size={16} />
                  Confirmar via WhatsApp
                </button>
              ) : (
                <p className="swp-drawer__hint swp-drawer__hint--visible">
                  Cadastre um telefone válido no agendamento para enviar WhatsApp.
                </p>
              )}
              {canCancel && (
                <button
                  type="button"
                  className="swp-drawer__btn swp-drawer__btn--danger"
                  onClick={handleCancel}
                >
                  Cancelar atendimento
                </button>
              )}
              <button
                type="button"
                className="swp-drawer__btn swp-drawer__btn--primary"
                onClick={handleFinish}
                disabled={!canFinish}
              >
                Finalizar e cobrar
              </button>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

/* —— Página —— */

export default function SchedulerWeekPreview() {
  const { barbers, services, products } = useApp();
  const activeBarbers = useMemo(() => {
    const list = barbers.filter((b) => b.role === 'Barbeiro' && b.status === 'Ativo');
    return list.length ? list : MOCK_BARBERS_FALLBACK;
  }, [barbers]);

  const barberIdsKey = useMemo(
    () => activeBarbers.map((b) => b.id).join(','),
    [activeBarbers]
  );

  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [viewMonth, setViewMonth] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [barberFilter, setBarberFilter] = useState('all');
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [nowMinutes, setNowMinutes] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });
  const [weekKey, setWeekKey] = useState(0);
  const [appointments, setAppointments] = useState([]);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const weekStart = useMemo(() => startOfWeek(selectedDate), [selectedDate]);

  useEffect(() => {
    setAppointments((prev) => {
      const manual = prev.filter((a) => a.isManual);
      const overrides = new Map(
        prev.filter((a) => !a.isManual).map((a) => [a.id, a.status])
      );
      const mock = buildMockAppointments(weekStart, activeBarbers).map((m) => {
        const status = overrides.get(m.id);
        return status && status !== m.status ? { ...m, status } : m;
      });
      const weekStartIso = toIsoLocal(weekStart);
      const weekEndIso = toIsoLocal(addDays(weekStart, 6));
      const manualInWeek = manual.filter(
        (a) => a.date >= weekStartIso && a.date <= weekEndIso
      );
      return [...mock, ...manualInWeek];
    });
    setSelectedAppt(null);
  }, [weekStart, barberIdsKey]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const mockAppts = appointments;
  const busyDates = useMemo(() => new Set(mockAppts.map((a) => a.date)), [mockAppts]);

  const filteredAppts = useMemo(() => {
    if (barberFilter === 'all') return mockAppts;
    return mockAppts.filter((a) => Number(a.barberId) === Number(barberFilter));
  }, [mockAppts, barberFilter]);

  const barberById = useMemo(() => {
    const map = {};
    activeBarbers.forEach((b) => { map[b.id] = b; });
    return map;
  }, [activeBarbers]);

  const hours = useMemo(() => hoursList(), []);

  useEffect(() => {
    const id = setInterval(() => {
      const n = new Date();
      setNowMinutes(n.getHours() * 60 + n.getMinutes());
    }, 60000);
    return () => clearInterval(id);
  }, []);

  const handleSelectDate = useCallback((day) => {
    setSelectedDate(day);
    setViewMonth(new Date(day.getFullYear(), day.getMonth(), 1));
    setWeekKey((k) => k + 1);
  }, []);

  const shiftWeek = (delta) => {
    handleSelectDate(addDays(selectedDate, delta * 7));
  };

  const goToday = () => handleSelectDate(new Date());

  const previewUpdateAppointmentStatus = useCallback(async (id, status, extraData = {}) => {
    setAppointments((prev) => prev.map((a) => (
      a.id === id ? { ...a, status, ...extraData } : a
    )));
    setSelectedAppt((prev) => (
      prev?.id === id ? { ...prev, status, ...extraData } : prev
    ));
    return true;
  }, []);

  const previewCancelAppointment = useCallback(async (id) => {
    setAppointments((prev) => prev.map((a) => (
      a.id === id ? { ...a, status: 'Cancelado' } : a
    )));
    setSelectedAppt((prev) => (
      prev?.id === id ? { ...prev, status: 'Cancelado' } : prev
    ));
    return true;
  }, []);

  const previewSellProduct = useCallback(async () => true, []);

  const appointmentActions = useAppointmentActions({
    services,
    products,
    updateAppointmentStatus: previewUpdateAppointmentStatus,
    cancelAppointment: previewCancelAppointment,
    sellProduct: previewSellProduct,
  });

  const openDrawerAction = useCallback((app, action) => {
    setSelectedAppt(null);
    action(app, null);
  }, []);

  const handleAddManualAppointment = useCallback((newAppt) => {
    setAppointments((prev) => [...prev, newAppt]);
    setAddModalOpen(false);
    const [y, m, d] = newAppt.date.split('-').map(Number);
    const apptDay = new Date(y, m - 1, d);
    if (!sameDay(apptDay, selectedDate)) {
      handleSelectDate(apptDay);
    }
  }, [selectedDate, handleSelectDate]);

  const openAddModal = useCallback(() => {
    setAddModalOpen(true);
  }, []);

  const showNowLine = weekDays.some((d) => sameDay(d, new Date()))
    && nowMinutes >= HOUR_START * 60
    && nowMinutes <= HOUR_END * 60;

  const weekCount = filteredAppts.length;

  return (
    <div className="swp">
      <header className="swp-topbar">
        <div className="swp-topbar__brand">
          <span className="swp-topbar__logo"><CalendarDays size={17} /></span>
          <div>
            <span className="swp-topbar__name">Agenda</span>
            <span className="swp-topbar__tag">Preview v2</span>
          </div>
        </div>

        <div className="swp-topbar__center">
          <div className="swp-week-nav" role="group" aria-label="Navegação da semana">
            <button
              type="button"
              className="swp-week-nav__btn"
              onClick={() => shiftWeek(-1)}
              aria-label="Semana anterior"
            >
              <ChevronLeft size={18} strokeWidth={2.25} aria-hidden />
            </button>
            <div className="swp-week-nav__label">
              <strong>{formatWeekRange(weekStart)}</strong>
              <span>{weekCount} atendimentos na semana</span>
            </div>
            <button
              type="button"
              className="swp-week-nav__btn"
              onClick={() => shiftWeek(1)}
              aria-label="Próxima semana"
            >
              <ChevronRight size={18} strokeWidth={2.25} aria-hidden />
            </button>
          </div>
          <button type="button" className="swp-today-btn" onClick={goToday}>Hoje</button>
          <button type="button" className="swp-add-btn" onClick={openAddModal}>
            <Plus size={15} strokeWidth={2.5} />
            Agendar
          </button>
        </div>

        <div className="swp-topbar__right">
          <div className="swp-team" role="group" aria-label="Filtrar por profissional">
            <button
              type="button"
              className={`swp-team__chip ${barberFilter === 'all' ? 'swp-team__chip--active' : ''}`}
              onClick={() => setBarberFilter('all')}
            >
              Todos
            </button>
            {activeBarbers.map((b) => (
              <BarberTeamAvatar
                key={b.id}
                barber={b}
                activeBarbers={activeBarbers}
                active={Number(barberFilter) === Number(b.id)}
                onClick={() => setBarberFilter(String(b.id))}
              />
            ))}
          </div>
          <Link to="/" className="swp-topbar__back">Sair</Link>
        </div>
      </header>

      <div className="swp-layout">
        <aside className="swp-sidebar">
          <MonthCalendar
            viewMonth={viewMonth}
            onViewMonthChange={setViewMonth}
            selectedDate={selectedDate}
            weekStart={weekStart}
            onSelectDate={handleSelectDate}
            busyDates={busyDates}
          />
          <DaySummary
            selectedDate={selectedDate}
            appointments={filteredAppts}
            barberById={barberById}
            onSelect={setSelectedAppt}
          />
        </aside>

        <main className="swp-main">
          <StatusLegend />
          <div className="swp-week" key={weekKey}>
            <div className="swp-week__head">
              <div className="swp-week__gutter-spacer" />
              {weekDays.map((day, i) => {
                const isSelected = sameDay(day, selectedDate);
                const isToday = sameDay(day, new Date());
                return (
                  <button
                    key={toIsoLocal(day)}
                    type="button"
                    className={[
                      'swp-week__day-head',
                      isSelected ? 'swp-week__day-head--selected' : '',
                      isToday ? 'swp-week__day-head--today' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => handleSelectDate(day)}
                  >
                    <span className="swp-week__day-name">{DAY_NAMES_SHORT[i]}</span>
                    <span className="swp-week__day-num">{day.getDate()}</span>
                  </button>
                );
              })}
            </div>

            <div className="swp-week__body">
              <div className="swp-week__times" style={{ height: GRID_HEIGHT }}>
                {hours.map((h) => (
                  <div
                    key={h}
                    className="swp-week__time-label"
                    style={{ top: (parseTimeToMinutes(h) - HOUR_START * 60) * PX_PER_MINUTE }}
                  >
                    {h}
                  </div>
                ))}
              </div>

              <div className="swp-week__cols" style={{ height: GRID_HEIGHT }}>
                {showNowLine && (
                  <div
                    className="swp-week__now"
                    style={{ top: (nowMinutes - HOUR_START * 60) * PX_PER_MINUTE }}
                  >
                    <span className="swp-week__now-label">
                      {`${String(Math.floor(nowMinutes / 60)).padStart(2, '0')}:${String(nowMinutes % 60).padStart(2, '0')}`}
                    </span>
                  </div>
                )}

                {weekDays.map((day, i) => {
                  const iso = toIsoLocal(day);
                  const dayAppts = filteredAppts.filter((a) => a.date === iso);
                  const laid = layoutDayColumns(dayAppts);
                  const isSelected = sameDay(day, selectedDate);
                  const isWeekend = i >= 5;

                  return (
                    <div
                      key={iso}
                      className={[
                        'swp-week__col',
                        isSelected ? 'swp-week__col--selected' : '',
                        isWeekend ? 'swp-week__col--weekend' : '',
                      ].filter(Boolean).join(' ')}
                    >
                      {laid.map(({ appt, lane, laneCount }) => (
                        <AppointmentBlock
                          key={appt.id}
                          appt={appt}
                          barberName={barberById[appt.barberId]?.name || '—'}
                          lane={lane}
                          laneCount={laneCount}
                          onSelect={setSelectedAppt}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </main>
      </div>

      <DetailDrawer
        appt={selectedAppt}
        barberName={selectedAppt ? barberById[selectedAppt.barberId]?.name : ''}
        onClose={() => setSelectedAppt(null)}
        onCancelClick={(app) => openDrawerAction(app, appointmentActions.handleQuickCancel)}
        onStartClick={(app) => openDrawerAction(app, appointmentActions.handleQuickStart)}
        onFinishClick={(app) => openDrawerAction(app, appointmentActions.handleQuickConfirm)}
      />

      <AppointmentActionModal
        {...appointmentActions}
        services={services}
        products={products}
      />

      <AddManualModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSave={handleAddManualAppointment}
        services={services}
        activeBarbers={activeBarbers}
        appointments={appointments}
        defaultDate={toIsoLocal(selectedDate)}
        defaultBarberId={barberFilter !== 'all' ? String(barberFilter) : ''}
      />
    </div>
  );
}
