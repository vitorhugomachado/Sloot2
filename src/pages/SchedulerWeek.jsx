import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X, Clock, User, Scissors, Plus } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getBarberColor, getBarberInitials, getBarberShortName } from '../utils/barberDisplay';
import { normalizePhoneForWhatsApp, openWhatsAppConfirm } from '../utils/appointmentWhatsApp';
import { getStaffBookingFormError } from '../utils/staffBookingForm';
import { STAFF_SCHEDULER_TIME_SLOTS } from '../utils/publicBookingSlots';
import { isBarberScheduleOpen, parseDurationMinutes } from '../utils/barberAvailability';
import {
  filterAvailableBookingTimes,
  getAppointmentDurationMinutes,
  isBookingSlotInPast,
  isBookingSlotTaken,
  normalizeBookingTime,
} from '../utils/bookingAvailability';
import WhatsAppIcon from '../components/icons/WhatsAppIcon';
import AppointmentActionModal from '../components/appointments/AppointmentActionModal';
import { useAppointmentActions } from '../hooks/useAppointmentActions';
import { toIsoLocal } from '../utils/dateLocal';
import { API_URL } from '../config/apiUrl';
import './scheduler-week.css';

const HOUR_START = 8;
const HOUR_END = 21;
const PX_PER_MINUTE = 60 / 60;
const SLOT_PX = 30;
const TIME_PAD = 12; // espaço p/ label 08:00 não cortar (alinha com --swp-time-pad)
const GRID_HEIGHT = (HOUR_END - HOUR_START) * 60 * PX_PER_MINUTE;
const GRID_TOTAL_HEIGHT = GRID_HEIGHT + TIME_PAD;

function timeTop(hhmmOrMinutes) {
  const mins = typeof hhmmOrMinutes === 'number'
    ? hhmmOrMinutes
    : parseTimeToMinutes(hhmmOrMinutes);
  return TIME_PAD + (mins - HOUR_START * 60) * PX_PER_MINUTE;
}
const DAY_NAMES_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const DAY_NAMES_MINI = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const HOVER_TIP_MS = 2000;
const MOBILE_DAY_CHIPS = 28;
const MOBILE_BREAKPOINT = 768;

function softDayHaptic() {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try { navigator.vibrate(8); } catch { /* ignore */ }
}

const MOCK_BARBERS_FALLBACK = [
  { id: 1, name: 'Carlos', foto_perfil: null },
  { id: 2, name: 'Rafael', foto_perfil: null },
  { id: 3, name: 'Diego', foto_perfil: null },
];

function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

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

const STATUS_STYLES = {
  Agendado: {
    accent: '#9CA3AF', soft: '#FFFFFF', border: '#E5E7EB',
    label: 'Sem confirmação', legend: 'Sem confirmação',
  },
  Confirmado: {
    accent: '#059669', soft: '#ECFDF5', border: '#A7F3D0',
    label: 'Confirmado', legend: 'Confirmado (WhatsApp)',
  },
  'Em progresso': {
    accent: '#2563EB', soft: '#EFF6FF', border: '#BFDBFE',
    label: 'Em atendimento', legend: 'Em atendimento',
  },
  Finalizado: {
    accent: '#047857', soft: '#F0FDF4', border: '#BBF7D0',
    label: 'Finalizado', legend: 'Finalizado',
  },
  Cancelado: {
    accent: '#DC2626', soft: '#FEF2F2', border: '#FECACA',
    label: 'Cancelado', legend: 'Cancelado',
  },
};

const LEGEND_ITEMS = [
  STATUS_STYLES.Agendado,
  STATUS_STYLES.Confirmado,
  STATUS_STYLES['Em progresso'],
  STATUS_STYLES.Finalizado,
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

function withDuration(appt, services) {
  return {
    ...appt,
    durationMinutes: getAppointmentDurationMinutes(appt, services),
  };
}

function canBookSlot({ dateIso, time, barber, appointments, services, durationMinutes = 30 }) {
  if (!dateIso || !time) return false;
  if (isBookingSlotInPast(dateIso, time)) return false;
  if (!barber) return false;
  if (isBookingSlotTaken(appointments, dateIso, time, barber.id, { durationMinutes, services })) {
    return false;
  }
  return isBarberScheduleOpen({
    barber,
    dateIso,
    time,
    durationMinutes,
  });
}

function anyBarberCanBook({ dateIso, time, activeBarbers, appointments, services }) {
  return activeBarbers.some((b) => canBookSlot({
    dateIso, time, barber: b, appointments, services,
  }));
}

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
        <div className="swp-cal__arrows">
          <button
            type="button"
            className="swp-icon-btn"
            aria-label="Mês anterior"
            onClick={() => onViewMonthChange(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            className="swp-icon-btn"
            aria-label="Próximo mês"
            onClick={() => onViewMonthChange(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div className="swp-cal__weekdays">
        {DAY_NAMES_MINI.map((d, i) => <span key={`${d}-${i}`}>{d}</span>)}
      </div>
      <div className="swp-cal__grid">
        {cells.map((day, idx) => {
          if (!day) return <span key={`e-${idx}`} className="swp-cal__cell swp-cal__cell--empty" />;
          const iso = toIsoLocal(day);
          const inWeek = day >= weekStart && day <= weekEnd;
          const isSelected = sameDay(day, selectedDate);
          const isToday = sameDay(day, today);
          const busy = busyDates.has(iso);
          return (
            <button
              key={iso}
              type="button"
              className={[
                'swp-cal__cell',
                inWeek ? 'swp-cal__cell--in-week' : '',
                isSelected ? 'swp-cal__cell--selected' : '',
                isToday ? 'swp-cal__cell--today' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => onSelectDate(day, { dayView: true })}
            >
              {day.getDate()}
              {busy ? <i className="swp-cal__dot" aria-hidden /> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function DaySummary({ selectedDate, appointments, barberById, onSelect }) {
  const iso = toIsoLocal(selectedDate);
  const dayAppts = useMemo(
    () => appointments
      .filter((a) => a.date === iso)
      .sort((a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time)),
    [appointments, iso]
  );

  return (
    <section className="swp-summary" aria-label="Resumo do dia">
      <h3 className="swp-summary__title">{formatSelectedLabel(selectedDate)}</h3>
      {dayAppts.length === 0 ? (
        <p className="swp-summary__empty">Nenhum atendimento neste dia.</p>
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

function AppointmentBlock({ appt, barberName, lane, laneCount, onSelect, onHoverEnter, onHoverLeave }) {
  const top = timeTop(appt.time);
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
      onMouseEnter={(e) => onHoverEnter?.(appt, barberName, e)}
      onMouseLeave={() => onHoverLeave?.()}
      title={`${scheduleLabel} · ${appt.customer} · ${appt.service}`}
    >
      <span className="swp-block__title">{appt.customer}</span>
      <span className="swp-block__meta">{scheduleLabel}</span>
      {showService && <span className="swp-block__service">{appt.service}</span>}
    </button>
  );
}

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

function SlotOverlay({ dateIso, barber, activeBarbers, appointments, services, onBook }) {
  return (
    <div className="swp-slots" aria-hidden>
      {STAFF_SCHEDULER_TIME_SLOTS.map((time) => {
        const mins = parseTimeToMinutes(time);
        if (mins < HOUR_START * 60 || mins > HOUR_END * 60) return null;
        const top = timeTop(mins);
        const free = barber
          ? canBookSlot({ dateIso, time, barber, appointments, services })
          : anyBarberCanBook({ dateIso, time, activeBarbers, appointments, services });
        if (!free) return null;
        return (
          <button
            key={time}
            type="button"
            className="swp-slot-plus"
            style={{ top, height: SLOT_PX }}
            title={`Agendar ${time}`}
            onClick={(e) => {
              e.stopPropagation();
              onBook(dateIso, time, barber ? String(barber.id) : '');
            }}
          >
            <Plus size={12} strokeWidth={2.5} />
          </button>
        );
      })}
    </div>
  );
}

/* —— Modal: agendar —— */

function AddManualModal({
  open,
  onClose,
  onSave,
  services,
  activeBarbers,
  appointments,
  defaults,
  token,
  apiFetch,
  lockBarberId = '',
}) {
  const [form, setForm] = useState({
    customer: '', phone: '', serviceId: '', barberId: '', date: '', time: '', customerId: null,
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [clientSearchResults, setClientSearchResults] = useState([]);
  const [clientSearchLoading, setClientSearchLoading] = useState(false);
  const debouncedClientSearch = useDebounce(clientSearchQuery, 300);

  useEffect(() => {
    if (!open) return;
    setForm({
      customer: defaults.customer || '',
      phone: defaults.phone || '',
      serviceId: services[0]?.id ? String(services[0].id) : '',
      barberId: lockBarberId || defaults.barberId || (activeBarbers[0]?.id ? String(activeBarbers[0].id) : ''),
      date: defaults.date,
      time: defaults.time || '09:00',
      customerId: defaults.customerId ?? null,
    });
    setClientSearchQuery(defaults.customer || '');
    setClientSearchResults([]);
    setError(null);
    setSaving(false);
  }, [open, services, activeBarbers, defaults, lockBarberId]);

  useEffect(() => {
    if (!open || !token || !apiFetch) {
      setClientSearchResults([]);
      return undefined;
    }
    const q = debouncedClientSearch.trim();
    if (q.length < 2) {
      setClientSearchResults([]);
      return undefined;
    }
    let cancelled = false;
    setClientSearchLoading(true);
    const params = new URLSearchParams({ page: '1', pageSize: '8', search: q });
    apiFetch(`${API_URL}/clients?${params.toString()}`, { authScope: 'staff' })
      .then(async (res) => {
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) setClientSearchResults(data.items || []);
      })
      .catch(() => {
        if (!cancelled) setClientSearchResults([]);
      })
      .finally(() => {
        if (!cancelled) setClientSearchLoading(false);
      });
    return () => { cancelled = true; };
  }, [debouncedClientSearch, open, token, apiFetch]);

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

  const selectCrmClient = (client) => {
    setForm((prev) => ({
      ...prev,
      customer: client.name || prev.customer,
      phone: client.phone || prev.phone,
      customerId: client.source === 'customer' && client.id ? Number(client.id) : null,
    }));
    setClientSearchQuery('');
    setClientSearchResults([]);
  };

  const handleSubmit = async (e) => {
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
    const normalizedTime = normalizeBookingTime(form.time);
    if (!normalizedTime) {
      setError('Selecione um horário disponível.');
      return;
    }
    if (isBookingSlotTaken(appointments, form.date, normalizedTime, form.barberId, {
      durationMinutes,
      services,
    })) {
      setError('Este horário já está reservado para o profissional selecionado.');
      return;
    }
    const selectedService = services.find((s) => String(s.id) === String(form.serviceId));
    setSaving(true);
    try {
      const result = await onSave({
        customer: form.customer.trim(),
        phone: form.phone.trim(),
        service: selectedService?.name || 'Serviço',
        barberId: Number(form.barberId),
        date: form.date,
        time: normalizedTime,
        durationMinutes,
        status: 'Agendado',
        price: Number(selectedService?.price) || 0,
        ...(form.customerId ? { customerId: form.customerId } : {}),
      });
      if (!result?.ok) {
        setError(result?.message || 'Não foi possível salvar o agendamento.');
      }
    } finally {
      setSaving(false);
    }
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
          {token ? (
            <label className="swp-modal__field">
              <span>Buscar cliente</span>
              <input
                type="text"
                value={clientSearchQuery}
                onChange={(ev) => {
                  setClientSearchQuery(ev.target.value);
                  if (!ev.target.value.trim()) {
                    setForm((prev) => ({ ...prev, customerId: null }));
                  }
                }}
                placeholder="Nome ou telefone cadastrado"
              />
              {clientSearchLoading && <p className="swp-modal__hint">Buscando…</p>}
              {!clientSearchLoading && clientSearchResults.length > 0 && (
                <ul className="swp-modal__suggestions">
                  {clientSearchResults.map((client) => (
                    <li key={`${client.source}-${client.id || client.guestKey}`}>
                      <button type="button" onClick={() => selectCrmClient(client)}>
                        <strong>{client.name}</strong>
                        {client.phone ? <span>{client.phone}</span> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </label>
          ) : null}

          <label className="swp-modal__field">
            <span>Nome do cliente *</span>
            <input
              type="text"
              autoComplete="name"
              value={form.customer}
              onChange={(ev) => {
                setError(null);
                setForm((prev) => ({ ...prev, customer: ev.target.value, customerId: null }));
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
                setForm((prev) => ({ ...prev, phone: ev.target.value, customerId: null }));
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

          {lockBarberId ? (
            <div className="swp-modal__field">
              <span>Profissional *</span>
              <div className="swp-modal__static">
                {activeBarbers.find((b) => String(b.id) === String(lockBarberId))?.name || 'Você'}
              </div>
            </div>
          ) : (
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
          )}

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
            <button type="submit" className="swp-drawer__btn swp-drawer__btn--primary" disabled={saving}>
              <Plus size={16} />
              {saving ? 'Salvando…' : 'Confirmar agendamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DetailDrawer({
  appt, barberName, onClose, onCancelClick, onStartClick, onFinishClick, onMoreActions, onWhatsAppConfirm,
}) {
  if (!appt) return null;
  const st = statusStyle(appt.status);
  const isCancelled = appt.status === 'Cancelado';
  const isFinished = appt.status === 'Finalizado';
  const isInProgress = appt.status === 'Em progresso' || appt.status === 'Em atendimento';
  const canStart = ['Agendado', 'Confirmado'].includes(appt.status);
  const canFinish = isInProgress;
  const canCancel = !isCancelled && !isFinished;
  const canMore = !isCancelled && !isFinished;
  const waPhone = normalizePhoneForWhatsApp(appt.phone);
  const canWhatsApp = Boolean(waPhone) && !isCancelled && !isFinished;
  const duration = appt.durationMinutes || 30;

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
              {appt.date.split('-').reverse().join('/')} · {appt.time}–{endTimeLabel(appt.time, duration)}
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
                onClick={() => canStart && onStartClick(appt)}
                disabled={!canStart}
              >
                {isInProgress ? 'Em atendimento' : 'Iniciar atendimento'}
              </button>
              {canWhatsApp ? (
                <button
                  type="button"
                  className="swp-drawer__btn swp-drawer__btn--whatsapp"
                  onClick={() => (onWhatsAppConfirm ? onWhatsAppConfirm(appt) : openWhatsAppConfirm(appt))}
                >
                  <WhatsAppIcon size={16} />
                  Confirmar via WhatsApp
                </button>
              ) : (
                <p className="swp-drawer__hint swp-drawer__hint--visible">
                  Cadastre um telefone válido no agendamento para enviar WhatsApp.
                </p>
              )}
              {canMore && (
                <button
                  type="button"
                  className="swp-drawer__btn swp-drawer__btn--ghost"
                  onClick={() => onMoreActions(appt)}
                >
                  Mais ações / trocar serviço
                </button>
              )}
              {canCancel && (
                <button
                  type="button"
                  className="swp-drawer__btn swp-drawer__btn--danger"
                  onClick={() => onCancelClick(appt)}
                >
                  Cancelar atendimento
                </button>
              )}
              <button
                type="button"
                className="swp-drawer__btn swp-drawer__btn--primary"
                onClick={() => canFinish && onFinishClick(appt)}
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

export default function SchedulerWeek() {
  const {
    barbers,
    services,
    products,
    appointments: contextAppointments,
    addAppointment,
    updateAppointmentStatus,
    cancelAppointment,
    sellProduct,
    apiFetch,
    token,
    financeV2,
  } = useApp();
  const location = useLocation();

  const activeBarbers = useMemo(() => {
    const list = barbers.filter((b) => b.role === 'Barbeiro' && b.status === 'Ativo');
    return list.length ? list : MOCK_BARBERS_FALLBACK;
  }, [barbers]);

  const appointments = useMemo(
    () => (Array.isArray(contextAppointments) ? contextAppointments : [])
      .map((a) => withDuration(a, services)),
    [contextAppointments, services]
  );

  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [desktopView, setDesktopView] = useState('week');
  const [isNarrow, setIsNarrow] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches : false
  );
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
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [modalDefaults, setModalDefaults] = useState({
    date: toIsoLocal(new Date()),
    time: '09:00',
    barberId: '',
    customer: '',
    phone: '',
    customerId: null,
  });
  const [hoverTip, setHoverTip] = useState(null);
  const hoverTimerRef = useRef(null);
  const mobileChipRef = useRef(null);

  useEffect(() => {
    if (!location.pathname.includes('scheduler')) return;
    let raw = null;
    try {
      raw = sessionStorage.getItem('scheduler_prefill');
    } catch {
      return;
    }
    if (!raw) return;
    try {
      sessionStorage.removeItem('scheduler_prefill');
      const data = JSON.parse(raw);
      setModalDefaults({
        date: toIsoLocal(new Date()),
        time: '09:00',
        barberId: barberFilter !== 'all' ? String(barberFilter) : '',
        customer: data.customer || '',
        phone: data.phone || '',
        customerId: data.customer_id != null ? Number(data.customer_id) : null,
      });
      setAddModalOpen(true);
    } catch {
      /* ignore bad prefill */
    }
  }, [location.pathname, location.key, barberFilter]);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const onChange = () => setIsNarrow(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const weekStart = useMemo(() => startOfWeek(selectedDate), [selectedDate]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );
  const selectedIso = toIsoLocal(selectedDate);

  const filteredAppts = useMemo(() => {
    let list = appointments;
    if (barberFilter !== 'all') {
      list = list.filter((a) => String(a.barberId) === String(barberFilter));
    }
    if (desktopView === 'day') {
      return list.filter((a) => a.date === selectedIso);
    }
    const startIso = toIsoLocal(weekStart);
    const endIso = toIsoLocal(addDays(weekStart, 6));
    return list.filter((a) => a.date >= startIso && a.date <= endIso);
  }, [appointments, barberFilter, desktopView, selectedIso, weekStart]);

  const busyDates = useMemo(() => {
    const set = new Set();
    appointments.forEach((a) => {
      if (barberFilter !== 'all' && String(a.barberId) !== String(barberFilter)) return;
      if (a.status === 'Cancelado') return;
      set.add(a.date);
    });
    return set;
  }, [appointments, barberFilter]);

  const barberById = useMemo(() => {
    const map = {};
    activeBarbers.forEach((b) => { map[b.id] = b; map[String(b.id)] = b; });
    return map;
  }, [activeBarbers]);

  const hours = useMemo(() => hoursList(), []);

  const dayColumns = useMemo(() => {
    if (desktopView !== 'day') return [];
    if (barberFilter !== 'all') {
      const b = activeBarbers.find((x) => String(x.id) === String(barberFilter));
      return b ? [b] : activeBarbers.slice(0, 1);
    }
    return activeBarbers;
  }, [desktopView, barberFilter, activeBarbers]);

  useEffect(() => {
    const id = setInterval(() => {
      const n = new Date();
      setNowMinutes(n.getHours() * 60 + n.getMinutes());
    }, 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!selectedAppt) return;
    const fresh = appointments.find((a) => String(a.id) === String(selectedAppt.id));
    if (!fresh) {
      setSelectedAppt(null);
      return;
    }
    if (fresh !== selectedAppt) setSelectedAppt(withDuration(fresh, services));
  }, [appointments, selectedAppt, services]);

  const clearHoverTip = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setHoverTip(null);
  }, []);

  const onHoverEnter = useCallback((appt, barberName, event) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    const rect = event.currentTarget.getBoundingClientRect();
    hoverTimerRef.current = setTimeout(() => {
      const st = statusStyle(appt.status);
      setHoverTip({
        x: Math.min(rect.left, window.innerWidth - 280),
        y: Math.min(rect.bottom + 8, window.innerHeight - 160),
        customer: appt.customer,
        barberName,
        service: appt.service,
        status: st.label,
        statusAccent: st.accent,
        when: `${appt.date.split('-').reverse().join('/')} · ${appt.time}`,
        price: Number(appt.price || 0).toFixed(2),
      });
    }, HOVER_TIP_MS);
  }, []);

  const handleSelectDate = useCallback((day, opts = {}) => {
    setSelectedDate(day);
    setViewMonth(new Date(day.getFullYear(), day.getMonth(), 1));
    setWeekKey((k) => k + 1);
    clearHoverTip();
    if (opts.dayView) setDesktopView('day');
  }, [clearHoverTip]);

  useEffect(() => {
    if (!location.state?.schedulerDayView) return;
    const today = new Date();
    setSelectedDate(today);
    setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setDesktopView('day');
    setWeekKey((k) => k + 1);
  }, [location.state?.schedulerDayView, location.state?.at]);

  const shiftNav = (delta) => {
    if (desktopView === 'day' && !isNarrow) {
      handleSelectDate(addDays(selectedDate, delta), { dayView: true });
      return;
    }
    handleSelectDate(addDays(selectedDate, delta * 7));
    setDesktopView('week');
  };

  const goToday = () => {
    handleSelectDate(new Date(), desktopView === 'day' && !isNarrow ? { dayView: true } : {});
    if (isNarrow) setDesktopView('week');
  };

  const appointmentActions = useAppointmentActions({
    services,
    products,
    updateAppointmentStatus,
    cancelAppointment,
    sellProduct,
    financeV2,
  });

  const openDrawerAction = useCallback((app, action) => {
    setSelectedAppt(null);
    clearHoverTip();
    action(app, null);
  }, [clearHoverTip]);

  const openAddModal = useCallback((overrides = {}) => {
    clearHoverTip();
    setModalDefaults({
      date: overrides.date || toIsoLocal(selectedDate),
      time: overrides.time || '09:00',
      barberId: overrides.barberId
        || (barberFilter !== 'all' ? String(barberFilter) : ''),
      customer: overrides.customer || '',
      phone: overrides.phone || '',
      customerId: overrides.customerId ?? null,
    });
    setAddModalOpen(true);
  }, [selectedDate, barberFilter, clearHoverTip]);

  const handleSaveAppointment = useCallback(async (payload) => {
    const result = await addAppointment(payload);
    if (result?.ok) {
      setAddModalOpen(false);
      const [y, m, d] = payload.date.split('-').map(Number);
      const apptDay = new Date(y, m - 1, d);
      if (!sameDay(apptDay, selectedDate)) handleSelectDate(apptDay);
    }
    return result;
  }, [addAppointment, selectedDate, handleSelectDate]);

  const showNowLine = (
    desktopView === 'week'
      ? weekDays.some((d) => sameDay(d, new Date()))
      : sameDay(selectedDate, new Date())
  ) && nowMinutes >= HOUR_START * 60 && nowMinutes <= HOUR_END * 60;

  const weekCount = useMemo(() => {
    const startIso = toIsoLocal(weekStart);
    const endIso = toIsoLocal(addDays(weekStart, 6));
    return appointments.filter((a) => {
      if (a.date < startIso || a.date > endIso) return false;
      if (barberFilter !== 'all' && String(a.barberId) !== String(barberFilter)) return false;
      return true;
    }).length;
  }, [appointments, weekStart, barberFilter]);

  const gridColumns = desktopView === 'day' ? Math.max(dayColumns.length, 1) : 7;

  const mobileDayChips = useMemo(() => {
    const start = addDays(weekStart, -7);
    return Array.from({ length: MOBILE_DAY_CHIPS }, (_, i) => {
      const day = addDays(start, i);
      const iso = toIsoLocal(day);
      const wd = DAY_NAMES_SHORT[(day.getDay() + 6) % 7];
      return { day, iso, wd };
    });
  }, [weekStart]);

  useEffect(() => {
    if (!isNarrow || !mobileChipRef.current) return;
    mobileChipRef.current.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [selectedIso, isNarrow]);

  const mobileDayAppts = useMemo(() => {
    let list = appointments.filter((a) => a.date === selectedIso);
    if (barberFilter !== 'all') {
      list = list.filter((a) => String(a.barberId) === String(barberFilter));
    }
    return list;
  }, [appointments, selectedIso, barberFilter]);

  const getSlotAppts = useCallback((time) => {
    const slot = normalizeBookingTime(time);
    return mobileDayAppts.filter((a) => normalizeBookingTime(a.time) === slot);
  }, [mobileDayAppts]);

  const mobileFilterBarber = barberFilter !== 'all'
    ? activeBarbers.find((b) => String(b.id) === String(barberFilter))
    : null;

  return (
    <div className="swp">
      <header className="swp-topbar">
        <div className="swp-topbar__brand">
          <h1 className="swp-topbar__title">Agenda Semanal</h1>
        </div>

        <div className="swp-topbar__center swp-topbar__center--desktop">
          <div className="swp-week-nav" role="group" aria-label="Navegação">
            <button
              type="button"
              className="swp-week-nav__btn"
              onClick={() => shiftNav(-1)}
              aria-label={desktopView === 'day' ? 'Dia anterior' : 'Semana anterior'}
            >
              <ChevronLeft size={18} strokeWidth={2.25} aria-hidden />
            </button>
            <div className="swp-week-nav__label">
              <strong>
                {desktopView === 'day'
                  ? formatSelectedLabel(selectedDate)
                  : formatWeekRange(weekStart)}
              </strong>
              <span>
                {desktopView === 'day'
                  ? `${filteredAppts.length} neste dia`
                  : `${weekCount} atendimentos na semana`}
              </span>
            </div>
            <button
              type="button"
              className="swp-week-nav__btn"
              onClick={() => shiftNav(1)}
              aria-label={desktopView === 'day' ? 'Próximo dia' : 'Próxima semana'}
            >
              <ChevronRight size={18} strokeWidth={2.25} aria-hidden />
            </button>
          </div>
          <button type="button" className="swp-today-btn" onClick={goToday}>Hoje</button>
          {desktopView === 'day' && (
            <button
              type="button"
              className="swp-today-btn"
              onClick={() => { setDesktopView('week'); setWeekKey((k) => k + 1); }}
            >
              Ver semana
            </button>
          )}
          <button type="button" className="swp-add-btn" onClick={() => openAddModal()}>
            <Plus size={15} strokeWidth={2.5} />
            Agendar
          </button>
        </div>

        <div className="swp-topbar__right">
          <div className="swp-team" role="group" aria-label="Filtrar por profissional">
            <button
              type="button"
              className={`swp-team__chip ${barberFilter === 'all' ? 'swp-team__chip--active' : ''}`}
              onClick={() => {
                setBarberFilter('all');
                if (!isNarrow) setDesktopView('week');
              }}
            >
              Todos
            </button>
            {activeBarbers.map((b) => (
              <BarberTeamAvatar
                key={b.id}
                barber={b}
                activeBarbers={activeBarbers}
                active={Number(barberFilter) === Number(b.id)}
                onClick={() => {
                  setBarberFilter(String(b.id));
                  if (!isNarrow) setDesktopView('week');
                }}
              />
            ))}
          </div>
          <button type="button" className="swp-add-btn swp-add-btn--mobile" onClick={() => openAddModal()}>
            <Plus size={15} strokeWidth={2.5} />
            Agendar
          </button>
        </div>
      </header>

      <div className="swp-mobile-chips" role="tablist" aria-label="Dia">
        {mobileDayChips.map(({ day, iso, wd }) => {
          const active = iso === selectedIso;
          return (
            <button
              key={iso}
              type="button"
              role="tab"
              aria-selected={active}
              ref={active ? mobileChipRef : null}
              className={`swp-mobile-chip${active ? ' swp-mobile-chip--active' : ''}`}
              onClick={() => {
                handleSelectDate(day);
                softDayHaptic();
              }}
            >
              <span className="swp-mobile-chip__wd">{wd}</span>
              <span className="swp-mobile-chip__num">{day.getDate()}</span>
            </button>
          );
        })}
      </div>

      <div className="swp-mobile-layout">
        {STAFF_SCHEDULER_TIME_SLOTS.map((time) => {
          const cellApps = getSlotAppts(time);
          const slotPast = isBookingSlotInPast(selectedIso, time);
          const canBook = mobileFilterBarber
            ? canBookSlot({
              dateIso: selectedIso,
              time,
              barber: mobileFilterBarber,
              appointments,
              services,
            })
            : anyBarberCanBook({
              dateIso: selectedIso,
              time,
              activeBarbers,
              appointments,
              services,
            });
          return (
            <div key={time} className="swp-mobile-slot">
              <div className="swp-mobile-slot__time">{time}</div>
              <div className="swp-mobile-slot__body">
                {cellApps.length === 0 ? (
                  <button
                    type="button"
                    className="swp-mobile-slot__free"
                    disabled={slotPast || !canBook}
                    onClick={() => openAddModal({
                      date: selectedIso,
                      time,
                      barberId: mobileFilterBarber ? String(mobileFilterBarber.id) : '',
                    })}
                  >
                    Livre — toque para agendar
                  </button>
                ) : (
                  cellApps.map((app) => {
                    const st = statusStyle(app.status);
                    const actionable = app.status !== 'Finalizado' && app.status !== 'Cancelado';
                    return (
                      <button
                        key={app.id}
                        type="button"
                        className={`swp-mobile-card${app.status === 'Cancelado' ? ' swp-mobile-card--cancelled' : ''}`}
                        style={{
                          background: st.soft,
                          borderColor: st.border,
                          ['--swp-accent-block']: st.accent,
                        }}
                        disabled={!actionable}
                        onClick={() => actionable && setSelectedAppt(app)}
                      >
                        <strong>{app.customer}</strong>
                        <span>{app.service} · {getBarberShortName(barberById[app.barberId]?.name) || '—'}</span>
                        <span className="swp-mobile-card__meta">
                          <em style={{ color: st.accent }}>{st.label}</em>
                          <b>R$ {Number(app.price || 0).toFixed(2)}</b>
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="swp-layout swp-layout--desktop">
        <aside className="swp-sidebar">
          <MonthCalendar
            viewMonth={viewMonth}
            onViewMonthChange={setViewMonth}
            selectedDate={selectedDate}
            weekStart={weekStart}
            onSelectDate={(day) => handleSelectDate(day, { dayView: true })}
            busyDates={busyDates}
          />
          <DaySummary
            selectedDate={selectedDate}
            appointments={
              barberFilter === 'all'
                ? appointments
                : appointments.filter((a) => String(a.barberId) === String(barberFilter))
            }
            barberById={barberById}
            onSelect={setSelectedAppt}
          />
        </aside>

        <main className="swp-main">
          <StatusLegend />
          <div
            className="swp-week"
            key={`${desktopView}-${weekKey}`}
            style={{ ['--swp-cols']: gridColumns }}
          >
            <div className="swp-week__head">
              <div className="swp-week__gutter-spacer" />
              {desktopView === 'week'
                ? weekDays.map((day, i) => {
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
                      onClick={() => handleSelectDate(day, { dayView: true })}
                    >
                      <span className="swp-week__day-name">{DAY_NAMES_SHORT[i]}</span>
                      <span className="swp-week__day-num">{day.getDate()}</span>
                    </button>
                  );
                })
                : dayColumns.map((b) => (
                  <div key={b.id} className="swp-week__day-head swp-week__day-head--barber">
                    <span className="swp-week__day-name">{getBarberShortName(b.name) || b.name}</span>
                  </div>
                ))}
            </div>

            <div className="swp-week__body">
              <div className="swp-week__times" style={{ height: GRID_TOTAL_HEIGHT }}>
                {hours.map((h) => (
                  <div
                    key={h}
                    className="swp-week__time-label"
                    style={{ top: timeTop(h) }}
                  >
                    {h}
                  </div>
                ))}
              </div>

              <div
                className="swp-week__cols"
                style={{ height: GRID_TOTAL_HEIGHT }}
              >
                {showNowLine && (
                  <div
                    className="swp-week__now"
                    style={{ top: timeTop(nowMinutes) }}
                  >
                    <span className="swp-week__now-label">
                      {`${String(Math.floor(nowMinutes / 60)).padStart(2, '0')}:${String(nowMinutes % 60).padStart(2, '0')}`}
                    </span>
                  </div>
                )}

                {desktopView === 'week'
                  ? weekDays.map((day, i) => {
                    const iso = toIsoLocal(day);
                    const dayAppts = filteredAppts.filter((a) => a.date === iso);
                    const laid = layoutDayColumns(dayAppts);
                    const isSelected = sameDay(day, selectedDate);
                    const isWeekend = i >= 5;
                    const filterBarber = barberFilter !== 'all'
                      ? activeBarbers.find((b) => String(b.id) === String(barberFilter))
                      : null;

                    return (
                      <div
                        key={iso}
                        className={[
                          'swp-week__col',
                          isSelected ? 'swp-week__col--selected' : '',
                          isWeekend ? 'swp-week__col--weekend' : '',
                        ].filter(Boolean).join(' ')}
                      >
                        <SlotOverlay
                          dateIso={iso}
                          barber={filterBarber}
                          activeBarbers={activeBarbers}
                          appointments={appointments}
                          services={services}
                          onBook={(date, time, barberId) => openAddModal({ date, time, barberId })}
                        />
                        {laid.map(({ appt, lane, laneCount }) => (
                          <AppointmentBlock
                            key={appt.id}
                            appt={appt}
                            barberName={barberById[appt.barberId]?.name || '—'}
                            lane={lane}
                            laneCount={laneCount}
                            onSelect={setSelectedAppt}
                            onHoverEnter={onHoverEnter}
                            onHoverLeave={clearHoverTip}
                          />
                        ))}
                      </div>
                    );
                  })
                  : dayColumns.map((barber) => {
                    const dayAppts = filteredAppts.filter(
                      (a) => String(a.barberId) === String(barber.id)
                    );
                    const laid = layoutDayColumns(dayAppts);
                    return (
                      <div key={barber.id} className="swp-week__col">
                        <SlotOverlay
                          dateIso={selectedIso}
                          barber={barber}
                          activeBarbers={activeBarbers}
                          appointments={appointments}
                          services={services}
                          onBook={(date, time, barberId) => openAddModal({ date, time, barberId })}
                        />
                        {laid.map(({ appt, lane, laneCount }) => (
                          <AppointmentBlock
                            key={appt.id}
                            appt={appt}
                            barberName={barber.name}
                            lane={lane}
                            laneCount={laneCount}
                            onSelect={setSelectedAppt}
                            onHoverEnter={onHoverEnter}
                            onHoverLeave={clearHoverTip}
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

      {hoverTip && (
        <div
          className="swp-hover-tip"
          style={{ left: hoverTip.x, top: hoverTip.y }}
          role="tooltip"
        >
          <strong>{hoverTip.customer}</strong>
          <span style={{ color: hoverTip.statusAccent }}>{hoverTip.status}</span>
          <span>{hoverTip.barberName}</span>
          <span>{hoverTip.service}</span>
          <span>{hoverTip.when}</span>
          <span>R$ {hoverTip.price}</span>
        </div>
      )}

      <DetailDrawer
        appt={selectedAppt}
        barberName={selectedAppt ? barberById[selectedAppt.barberId]?.name : ''}
        onClose={() => setSelectedAppt(null)}
        onCancelClick={(app) => openDrawerAction(app, appointmentActions.handleQuickCancel)}
        onStartClick={(app) => openDrawerAction(app, appointmentActions.handleQuickStart)}
        onFinishClick={(app) => openDrawerAction(app, appointmentActions.handleQuickConfirm)}
        onMoreActions={(app) => openDrawerAction(app, (a) => appointmentActions.openActionModal(a))}
        onWhatsAppConfirm={(app) => appointmentActions.handleWhatsAppConfirm(app)}
      />

      <AppointmentActionModal
        {...appointmentActions}
        services={services}
        products={products}
      />

      <AddManualModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSave={handleSaveAppointment}
        services={services}
        activeBarbers={activeBarbers}
        appointments={appointments}
        defaults={modalDefaults}
        token={token}
        apiFetch={apiFetch}
        lockBarberId=""
      />
    </div>
  );
}
