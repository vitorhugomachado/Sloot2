import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Clock, User, Scissors, X, Calendar as CalendarIcon, Users } from 'lucide-react';
import AppointmentActionModal from '../components/appointments/AppointmentActionModal';
import SchedulerApptBar from '../components/scheduler/SchedulerApptBar';
import { useApp } from '../context/AppContext';
import { useAppointmentActions } from '../hooks/useAppointmentActions';
import {
  appointmentOccupiesSlot,
  filterAvailableBookingTimes,
  isBookingSlotInPast,
  isBookingSlotTaken,
  normalizeBookingTime,
} from '../utils/bookingAvailability';
import { isBarberScheduleOpen, parseDurationMinutes } from '../utils/barberAvailability';
import { getAppointmentStatusStyle, getSchedulerStatusClass, isInServiceStatus } from '../utils/appointmentStatus';
import { STAFF_SCHEDULER_TIME_SLOTS } from '../utils/publicBookingSlots';
import { toIsoLocal } from '../utils/dateLocal';
import { getStaffBookingFormError } from '../utils/staffBookingForm';
import { API_URL } from '../config/apiUrl';

/** Altura dinâmica das linhas da grade conforme agendamentos no horário (semana visível). */
const SCHEDULER_CELL_PAD = 8;
const SCHEDULER_APPT_GAP = 3;
const SCHEDULER_APPT_MIN_H = 18;
const SCHEDULER_ROW_BASE_ALL = 49;
const SCHEDULER_ROW_BASE_SINGLE = 94;
const SCHEDULER_ROW_MAX_ALL = 114;
const SCHEDULER_ROW_MAX_SINGLE = 182;
const SCHEDULER_SINGLE_CARD_H = 52;

// Custom SVG "Arts" for maximum visibility and intuition
const QPlay = ({ size = 18, color = "#000000" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="11" fill={color} />
    <path d="M10 8l6 4-6 4V8z" fill="#FFFDF2" />
  </svg>
);
const QCheck = ({ size = 18, color = "#000000" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="11" fill={color} />
    <path d="M8 12l3 3 5-5" stroke="#FFFDF2" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const QCancel = ({ size = 18, color = "#ef4444" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="11" fill={color} />
    <path d="M15 9l-6 6M9 9l6 6" stroke="#FFFDF2" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const MOBILE_SCHEDULER_CALENDAR_DAYS = 28;
function softDayHaptic() {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(8);
  } catch {
    /* ignore */
  }
}

function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function buildSchedulerMonthGrid(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = [];
  for (let i = 0; i < startWeekday; i += 1) days.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) days.push(new Date(year, month, day));
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

function formatSchedulerDatePt(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

const Scheduler = () => {
  const {
    appointments,
    barbers,
    services,
    products,
    addAppointment,
    updateAppointmentStatus,
    cancelAppointment,
    sellProduct,
    currentUser,
    apiFetch,
    token,
  } = useApp();
  const [selectedDate, setSelectedDate] = useState(() => toIsoLocal(new Date()));
  const isBarber = currentUser?.role === 'Barbeiro';
  
  // Pre-select current user's agenda if they are a barber (locked)
  const [selectedBarberId, setSelectedBarberId] = useState(() => {
    if (isBarber) return String(currentUser.id);
    return 'all';
  });
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    customer: '',
    phone: '',
    serviceId: '',
    barberId: '',
    time: '09:00',
    date: '',
    customerId: null,
  });
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [clientSearchResults, setClientSearchResults] = useState([]);
  const [clientSearchLoading, setClientSearchLoading] = useState(false);
  const [bookingFormError, setBookingFormError] = useState(null);
  const debouncedClientSearch = useDebounce(clientSearchQuery, 300);

  const appointmentActions = useAppointmentActions({
    services,
    products,
    updateAppointmentStatus,
    cancelAppointment,
    sellProduct,
  });

  const schedulerWeekPickerRef = useRef(null);
  const schedulerActiveDayChipRef = useRef(null);
  const appointmentHoverTimerRef = useRef(null);
  const pendingAppointmentHoverIdRef = useRef(null);
  const [appointmentHoverTip, setAppointmentHoverTip] = useState(null);

  const [isSchedulerNarrow, setIsSchedulerNarrow] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  );

  const [showSchedulerMonthPicker, setShowSchedulerMonthPicker] = useState(false);
  const [desktopView, setDesktopView] = useState('week');
  const location = useLocation();
  const [schedulerCalendarMonth, setSchedulerCalendarMonth] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const fn = () => setIsSchedulerNarrow(mq.matches);
    fn();
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  useEffect(() => {
    if (location.state?.schedulerDayView !== true) return;
    setDesktopView('day');
    setSelectedDate(toIsoLocal(new Date()));
  }, [location.state?.schedulerDayView, location.state?.at]);

  useEffect(() => {
    if (!showSchedulerMonthPicker) return;
    const onDown = (e) => {
      if (schedulerWeekPickerRef.current?.contains(e.target)) return;
      setShowSchedulerMonthPicker(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [showSchedulerMonthPicker]);

  useEffect(() => {
    if (!showSchedulerMonthPicker) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setShowSchedulerMonthPicker(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showSchedulerMonthPicker]);

  useEffect(() => {
    if (!appointmentHoverTip) return;
    const onKey = (e) => {
      if (e.key === 'Escape') clearAppointmentHoverTip();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [appointmentHoverTip]);

  useEffect(() => () => {
    if (appointmentHoverTimerRef.current) {
      window.clearTimeout(appointmentHoverTimerRef.current);
    }
  }, []);

  const APPOINTMENT_HOVER_TIP_MS = 2000;

  const clearAppointmentHoverTip = () => {
    pendingAppointmentHoverIdRef.current = null;
    if (appointmentHoverTimerRef.current) {
      window.clearTimeout(appointmentHoverTimerRef.current);
      appointmentHoverTimerRef.current = null;
    }
    setAppointmentHoverTip(null);
  };

  const onAppointmentHoverEnter = (app, barberDisplayName) => (e) => {
    if (appointmentHoverTimerRef.current) {
      window.clearTimeout(appointmentHoverTimerRef.current);
      appointmentHoverTimerRef.current = null;
    }
    setAppointmentHoverTip(null);
    pendingAppointmentHoverIdRef.current = app.id;
    const el = e.currentTarget;
    appointmentHoverTimerRef.current = window.setTimeout(() => {
      appointmentHoverTimerRef.current = null;
      if (pendingAppointmentHoverIdRef.current !== app.id) return;
      if (!el?.isConnected) return;
      const r = el.getBoundingClientRect();
      const tipW = 280;
      const pad = 8;
      let left = r.right + pad;
      if (left + tipW > window.innerWidth - 12) {
        left = Math.max(12, r.left - tipW - pad);
      }
      let top = r.top;
      const estH = 140;
      if (top + estH > window.innerHeight - 12) {
        top = Math.max(12, window.innerHeight - estH - 12);
      }
      setAppointmentHoverTip({
        app,
        barberDisplayName: barberDisplayName || '—',
        left,
        top,
      });
    }, APPOINTMENT_HOVER_TIP_MS);
  };

  const openSchedulerMonthPicker = () => {
    const [y, m] = selectedDate.split('-').map(Number);
    setSchedulerCalendarMonth(new Date(y, m - 1, 1));
    setShowSchedulerMonthPicker(true);
  };
  const curr = new Date(selectedDate);
  curr.setMinutes(curr.getMinutes() + curr.getTimezoneOffset());
  
  const day = curr.getDay() || 7; 
  const startOfWeek = new Date(curr);
  startOfWeek.setDate(curr.getDate() - (day - 1));
  
  const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

  const mobileDayChips = useMemo(() => {
    if (!isSchedulerNarrow) {
      return days.map((dayLabel, colIndex) => {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + colIndex);
        return {
          iso: toIsoLocal(d),
          wd: dayLabel.slice(0, 3),
        };
      });
    }

    const rangeStart = new Date(startOfWeek);
    rangeStart.setDate(startOfWeek.getDate() - 7);
    const chips = [];
    for (let i = 0; i < MOBILE_SCHEDULER_CALENDAR_DAYS; i += 1) {
      const d = new Date(rangeStart);
      d.setDate(rangeStart.getDate() + i);
      chips.push({
        iso: toIsoLocal(d),
        wd: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').slice(0, 3),
      });
    }
    return chips;
  }, [isSchedulerNarrow, startOfWeek]);

  useEffect(() => {
    if (!isSchedulerNarrow || !schedulerActiveDayChipRef.current) return;
    schedulerActiveDayChipRef.current.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    });
  }, [selectedDate, isSchedulerNarrow]);

  const activeBarbers = useMemo(
    () => barbers.filter((b) => b.role === 'Barbeiro' && b.status === 'Ativo'),
    [barbers]
  );
  const dayHeaderHeight = 64;

  const handleOpenModal = (date, time) => {
    if (isBookingSlotInPast(date || selectedDate, time)) return;
    clearAppointmentHoverTip();
    setClientSearchQuery('');
    setClientSearchResults([]);
    setFormData({
      customer: '',
      phone: '',
      serviceId: '',
      barberId: isBarber ? String(currentUser.id) : selectedBarberId !== 'all' ? selectedBarberId : '',
      time: time || '09:00',
      date: date || selectedDate,
      customerId: null,
    });
    setBookingFormError(null);
    setIsModalOpen(true);
  };

  const bookingFormBarberId = isBarber ? String(currentUser.id) : formData.barberId;
  const bookingFormBarber = useMemo(
    () => barbers.find((b) => String(b.id) === String(bookingFormBarberId)) || null,
    [barbers, bookingFormBarberId]
  );
  const bookingDurationMinutes = useMemo(() => {
    const svc = services.find((s) => String(s.id) === String(formData.serviceId));
    return parseDurationMinutes(svc?.duration);
  }, [services, formData.serviceId]);

  const slotAvailabilityOpts = useMemo(
    () => ({
      barber: bookingFormBarber,
      durationMinutes: bookingDurationMinutes,
      services,
    }),
    [bookingFormBarber, bookingDurationMinutes, services]
  );

  const availableBookingTimes = useMemo(
    () =>
      filterAvailableBookingTimes(
        STAFF_SCHEDULER_TIME_SLOTS,
        appointments,
        formData.date,
        bookingFormBarberId,
        slotAvailabilityOpts
      ),
    [appointments, formData.date, bookingFormBarberId, slotAvailabilityOpts]
  );

  useEffect(() => {
    if (!isModalOpen || !token) {
      setClientSearchResults([]);
      return;
    }
    const q = debouncedClientSearch.trim();
    if (q.length < 2) {
      setClientSearchResults([]);
      return;
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
    return () => {
      cancelled = true;
    };
  }, [debouncedClientSearch, isModalOpen, token, apiFetch]);

  const selectCrmClient = (client) => {
    setFormData((prev) => ({
      ...prev,
      customer: client.name || prev.customer,
      phone: client.phone || prev.phone,
      customerId: client.source === 'customer' && client.id ? Number(client.id) : null,
    }));
    setClientSearchQuery('');
    setClientSearchResults([]);
  };

  useEffect(() => {
    if (!isModalOpen) return;
    const list = filterAvailableBookingTimes(
      STAFF_SCHEDULER_TIME_SLOTS,
      appointments,
      formData.date,
      bookingFormBarberId,
      slotAvailabilityOpts
    );
    setFormData((prev) => {
      if (list.length === 0) {
        return prev.time === '' ? prev : { ...prev, time: '' };
      }
      if (list.includes(prev.time)) return prev;
      return { ...prev, time: list[0] };
    });
  }, [isModalOpen, formData.date, bookingFormBarberId, appointments, slotAvailabilityOpts]);

  const handleSaveAppointment = async () => {
    const validationError = getStaffBookingFormError({
      customer: formData.customer,
      phone: formData.phone,
      serviceId: formData.serviceId,
      barberId: formData.barberId,
      time: formData.time,
      availableTimes: availableBookingTimes,
    });
    if (validationError) {
      setBookingFormError(validationError);
      return;
    }
    setBookingFormError(null);
    const effectiveTime =
      availableBookingTimes.length > 0
        ? availableBookingTimes.includes(formData.time)
          ? formData.time
          : availableBookingTimes[0]
        : '';
    const normalizedTime = normalizeBookingTime(effectiveTime);
    if (!normalizedTime) {
      window.alert('Não há horário disponível para concluir a reserva.');
      return;
    }
    if (
      isBookingSlotTaken(appointments, formData.date, normalizedTime, formData.barberId, {
        durationMinutes: bookingDurationMinutes,
        services,
      })
    ) {
      window.alert(
        'Este horário já está reservado para o profissional selecionado. Escolha outro horário disponível na lista.'
      );
      return;
    }
    const selectedService = services.find((s) => String(s.id) === String(formData.serviceId));

    const result = await addAppointment({
      customer: formData.customer,
      phone: formData.phone,
      service: selectedService?.name || 'Serviço',
      barberId: parseInt(formData.barberId, 10),
      date: formData.date,
      time: normalizedTime,
      status: 'Agendado',
      price: selectedService?.price || 0,
      durationMinutes: bookingDurationMinutes,
      ...(formData.customerId ? { customerId: formData.customerId } : {}),
    });

    if (result?.ok) {
      setIsModalOpen(false);
    } else {
      window.alert(result?.message || 'Não foi possível salvar o agendamento.');
    }
  };

  const openActionModal = (app, e) => {
    clearAppointmentHoverTip();
    e?.stopPropagation();
    appointmentActions.openActionModal(app);
  };

  const getDayDate = (colIndex) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + colIndex);
    return toIsoLocal(d);
  };

  const startStr = toIsoLocal(startOfWeek);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  const endStr = toIsoLocal(endOfWeek);

  const isDayGrid = desktopView === 'day';

  const gridColumns = useMemo(() => {
    if (isDayGrid) {
      if (selectedBarberId === 'all') {
        return activeBarbers.map((b) => ({
          kind: 'barber',
          key: `barber-${b.id}`,
          date: selectedDate,
          barberId: String(b.id),
          barber: b,
        }));
      }
      const barber =
        activeBarbers.find((b) => String(b.id) === String(selectedBarberId)) ||
        barbers.find((b) => String(b.id) === String(selectedBarberId));
      return [
        {
          kind: 'barber',
          key: `barber-${selectedBarberId}`,
          date: selectedDate,
          barberId: String(selectedBarberId),
          barber: barber || null,
        },
      ];
    }
    const weekBase = new Date(`${startStr}T12:00:00`);
    return Array.from({ length: 7 }, (_, col) => {
      const d = new Date(weekBase);
      d.setDate(weekBase.getDate() + col);
      const date = toIsoLocal(d);
      return { kind: 'date', key: date, date };
    });
  }, [isDayGrid, selectedDate, selectedBarberId, activeBarbers, barbers, startStr]);

  const filteredAppointments = useMemo(() => {
    return appointments.filter((app) => {
      const matchesBarber =
        selectedBarberId === 'all' || String(app.barberId) === String(selectedBarberId);
      if (isDayGrid) {
        return app.date === selectedDate && matchesBarber;
      }
      const inRange = app.date >= startStr && app.date <= endStr;
      return inRange && matchesBarber;
    });
  }, [appointments, isDayGrid, selectedDate, startStr, endStr, selectedBarberId]);

  const shiftDate = (daysCount) => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + daysCount);
    setSelectedDate(toIsoLocal(d));
  };

  const shiftDesktopDate = (direction) => {
    shiftDate(desktopView === 'day' ? direction : direction * 7);
  };

  const selectDesktopDay = (iso) => {
    setSelectedDate(iso);
    setDesktopView('day');
  };

  const getWeekdayLabelForIso = (iso) => {
    const d = new Date(`${iso}T12:00:00`);
    const dayIndex = (d.getDay() + 6) % 7;
    return days[dayIndex];
  };

  const getAppointmentsForCell = useCallback(
    (dateString, timeString, barberId = null) => {
      const slot = normalizeBookingTime(timeString);
      return filteredAppointments.filter((app) => {
        if (app.date !== dateString) return false;
        if (normalizeBookingTime(app.time) !== slot) return false;
        if (barberId != null && String(app.barberId) !== String(barberId)) return false;
        return true;
      });
    },
    [filteredAppointments]
  );

  const cellHasBlockingAppointment = useCallback(
    (dateString, timeString, barberId = null) =>
      filteredAppointments.some((app) => {
        if (app.date !== dateString) return false;
        if (barberId != null && String(app.barberId) !== String(barberId)) return false;
        return appointmentOccupiesSlot(app, timeString, services);
      }),
    [filteredAppointments, services]
  );

  const rowHeightsBySlot = useMemo(() => {
    return STAFF_SCHEDULER_TIME_SLOTS.map((time) => {
      let maxCount = 0;
      for (const col of gridColumns) {
        const date = col.date;
        const barberId = col.kind === 'barber' ? col.barberId : null;
        const n = filteredAppointments.filter(
          (a) =>
            a.date === date &&
            normalizeBookingTime(a.time) === normalizeBookingTime(time) &&
            (barberId == null || String(a.barberId) === String(barberId))
        ).length;
        if (n > maxCount) maxCount = n;
      }

      const useSingleRowStyle = isDayGrid;
      if (useSingleRowStyle) {
        if (maxCount <= 1) return SCHEDULER_ROW_BASE_SINGLE;
        const inner = maxCount * SCHEDULER_SINGLE_CARD_H + (maxCount - 1) * 3;
        return Math.min(SCHEDULER_ROW_MAX_SINGLE, SCHEDULER_CELL_PAD + inner);
      }

      if (maxCount <= 1) return SCHEDULER_ROW_BASE_ALL;
      const inner = maxCount * SCHEDULER_APPT_MIN_H + (maxCount - 1) * SCHEDULER_APPT_GAP;
      return Math.min(SCHEDULER_ROW_MAX_ALL, SCHEDULER_CELL_PAD + inner);
    });
  }, [filteredAppointments, selectedBarberId, gridColumns, isDayGrid]);

  const gridColCount = gridColumns.length;
  const gridTemplateColumns = isDayGrid
    ? `repeat(${gridColCount}, minmax(100px, 1fr))`
    : `repeat(${gridColCount}, minmax(0, 1fr))`;

  const apptCountClass = (count) =>
    `scheduler-cell-appts--count-${Math.min(Math.max(count, 0), 9)}`;

  const getStatusStyle = getAppointmentStatusStyle;

  return (
    <div className="fade-in scheduler-page">
      {/* Header Container */}
      <header className="scheduler-header" style={{ flexShrink: 0, marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        <div className="scheduler-header-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 style={{ fontSize: '2rem', marginBottom: '4px', letterSpacing: '-0.5px' }}>
              {isBarber ? 'Minha Agenda' : 'Agenda Semanal'}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              {isBarber ? 'Gerencie seus horários e atendimentos.' : 'Controle avançado de capacidade profissional.'}
            </p>
          </div>
          <div
            className="scheduler-mobile-day-chips scheduler-mobile-day-chips--header"
            role="tablist"
            aria-label="Dia da semana"
          >
            {mobileDayChips.map(({ iso, wd }) => {
              const active = iso === selectedDate;
              return (
                <button
                  key={iso}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  data-scheduler-day={iso}
                  ref={active ? schedulerActiveDayChipRef : null}
                  className={`scheduler-mobile-day-chip${active ? ' scheduler-mobile-day-chip--active' : ''}`}
                  onClick={() => {
                    setSelectedDate(iso);
                    softDayHaptic();
                  }}
                >
                  <span className="scheduler-mobile-day-chip__wd">{wd}</span>
                  <span className="scheduler-mobile-day-chip__num">{iso.split('-').reverse()[0]}</span>
                </button>
              );
            })}
          </div>
          <div className="scheduler-header-actions">
            {!isSchedulerNarrow && (
              <div ref={schedulerWeekPickerRef} style={{ position: 'relative' }}>
                <div className="glass-card scheduler-week-picker-bar">
                  <button
                    type="button"
                    className="scheduler-week-picker-nav-btn"
                    onClick={() => shiftDesktopDate(-1)}
                    aria-label={desktopView === 'day' ? 'Dia anterior' : 'Semana anterior'}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <CalendarIcon size={14} className="scheduler-week-picker-calendar-icon" aria-hidden />
                  <button
                    type="button"
                    className="scheduler-week-picker-date-btn"
                    onClick={() => openSchedulerMonthPicker()}
                    aria-label="Escolher data"
                    aria-haspopup="dialog"
                    aria-expanded={showSchedulerMonthPicker}
                  >
                    {formatSchedulerDatePt(selectedDate)}
                  </button>
                  <button
                    type="button"
                    className="scheduler-week-picker-nav-btn"
                    onClick={() => shiftDesktopDate(1)}
                    aria-label={desktopView === 'day' ? 'Próximo dia' : 'Próxima semana'}
                  >
                    <ChevronRight size={14} />
                  </button>
                  {desktopView === 'day' && (
                    <button
                      type="button"
                      className="scheduler-week-picker-view-week-btn"
                      onClick={() => setDesktopView('week')}
                    >
                      Ver semana
                    </button>
                  )}
                </div>
                {showSchedulerMonthPicker && (
                  <div className="booking-calendar-popover scheduler-week-picker-popover" role="dialog" aria-label="Calendário">
                    <div className="booking-calendar-header">
                      <button
                        type="button"
                        className="booking-calendar-nav"
                        onClick={() => setSchedulerCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                        aria-label="Mês anterior"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <strong style={{ textTransform: 'capitalize' }}>
                        {schedulerCalendarMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                      </strong>
                      <button
                        type="button"
                        className="booking-calendar-nav"
                        onClick={() => setSchedulerCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                        aria-label="Próximo mês"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                    <div className="booking-calendar-grid">
                      {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((wd, wi) => (
                        <span key={wi} className="booking-calendar-weekday">{wd}</span>
                      ))}
                      {buildSchedulerMonthGrid(schedulerCalendarMonth).map((day, idx) => {
                        if (!day) return <span key={`empty-${idx}`} className="booking-calendar-day empty" />;
                        const iso = toIsoLocal(day);
                        const isSelected = iso === selectedDate;
                        return (
                          <button
                            key={iso}
                            type="button"
                            className={`booking-calendar-day ${isSelected ? 'selected' : ''}`}
                            onClick={() => {
                              selectDesktopDay(iso);
                              setShowSchedulerMonthPicker(false);
                            }}
                          >
                            {day.getDate()}
                          </button>
                        );
                      })}
                    </div>
                    <div className="scheduler-week-picker-popover-footer">
                      <button
                        type="button"
                        className="scheduler-week-picker-popover-footer-btn"
                        onClick={() => {
                          selectDesktopDay(toIsoLocal(new Date()));
                          setShowSchedulerMonthPicker(false);
                        }}
                      >
                        Hoje
                      </button>
                      <button
                        type="button"
                        className="scheduler-week-picker-popover-footer-btn"
                        onClick={() => setShowSchedulerMonthPicker(false)}
                      >
                        Fechar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {!isSchedulerNarrow && (
              <button
                type="button"
                className="btn-primary scheduler-header-book-btn"
                onClick={() => handleOpenModal()}
              >
                <Plus size={16} /> Agendar
              </button>
            )}
          </div>
        </div>

        {/* Barber Filters — only visible for managers */}
        {!isBarber && (
          <div className="hide-scrollbar scheduler-barber-filters">
             <button 
               onClick={() => {
                 setSelectedBarberId('all');
                 if (!isSchedulerNarrow) setDesktopView('week');
               }}
               style={{ 
                 display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '20px',
                 fontWeight: 600, fontSize: '0.85rem', flexShrink: 0,
                 transition: 'all 0.2s ease',
                 background: selectedBarberId === 'all' ? 'var(--accent-color)' : 'var(--hover-bg)',
                 color: selectedBarberId === 'all' ? 'var(--accent-text)' : 'var(--text-secondary)',
                 border: '1px solid var(--border-color)'
               }}>
               <Users size={14} /> Todos
             </button>
             <div style={{ width: '1px', height: '24px', background: 'var(--border-color)', margin: '0 5px' }}></div>
             
             {activeBarbers.map(barber => (
               <button 
                 key={barber.id}
                 onClick={() => {
                   setSelectedBarberId(String(barber.id));
                   if (!isSchedulerNarrow) setDesktopView('week');
                 }}
                 style={{ 
                   display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px 6px 6px', borderRadius: '20px',
                   fontWeight: 600, fontSize: '0.85rem', flexShrink: 0,
                   transition: 'all 0.2s ease',
                   background: selectedBarberId === String(barber.id) ? 'var(--accent-color)' : 'var(--hover-bg)',
                   color: selectedBarberId === String(barber.id) ? 'var(--accent-text)' : 'var(--text-primary)',
                   border: '1px solid var(--border-color)',
                   boxShadow: 'none'
                 }}>
                 <div style={{ width: '24px', height: '24px', borderRadius: '50%', overflow: 'hidden', background: selectedBarberId === String(barber.id) ? 'rgba(255, 255, 255, 0.45)' : 'var(--icon-bg)', color: selectedBarberId === String(barber.id) ? '#1A1A1A' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>
                   {barber.foto_perfil ? <img src={barber.foto_perfil} alt={barber.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : barber.name.charAt(0)}
                 </div>
                 {barber.name.split(' ')[0]}
               </button>
             ))}
          </div>
        )}
      </header>

      {/* Mobile: lista vertical (visível só ≤768px via CSS) */}
      <div className="scheduler-mobile-layout">
          <div className="scheduler-mobile-list-scroll hide-scrollbar">
            {STAFF_SCHEDULER_TIME_SLOTS.map((time) => {
              const cellApps = getAppointmentsForCell(selectedDate, time);
              const slotPast = isBookingSlotInPast(selectedDate, time);
              return (
                <div key={time} className="scheduler-mobile-slot">
                  <div className="scheduler-mobile-slot__time">{time}</div>
                  <div className="scheduler-mobile-slot__body">
                    {cellApps.length === 0 ? (
                      <button
                        type="button"
                        className="scheduler-mobile-slot__free"
                        disabled={slotPast}
                        onClick={() => handleOpenModal(selectedDate, time)}
                        style={slotPast ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
                      >
                        Livre — toque para agendar
                      </button>
                    ) : selectedBarberId === 'all' ? (
                      <div className="scheduler-mobile-slot__macro">
                        {cellApps.map((app) => {
                          const b = barbers.find((br) => br.id === app.barberId);
                          const actionable = app.status !== 'Finalizado' && app.status !== 'Cancelado';
                          return (
                            <SchedulerApptBar
                              key={app.id}
                              app={app}
                              barber={b}
                              statusStyle={getStatusStyle(app.status)}
                              stackCount={cellApps.length}
                              activeBarbers={activeBarbers}
                              variant="mobile"
                              onMouseEnter={onAppointmentHoverEnter(app, b?.name)}
                              onMouseLeave={clearAppointmentHoverTip}
                              onClick={(e) => actionable && openActionModal(app, e)}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      cellApps.map((app) => {
                        const ss = getStatusStyle(app.status);
                        const actionable = app.status !== 'Finalizado' && app.status !== 'Cancelado';
                        return (
                          <button
                            key={app.id}
                            type="button"
                            className={`scheduler-mobile-single-card fade-in${isInServiceStatus(app.status) ? ' scheduler-appt--in-service' : ''}`}
                            onMouseEnter={onAppointmentHoverEnter(
                              app,
                              barbers.find((x) => x.id === app.barberId)?.name
                            )}
                            onMouseLeave={clearAppointmentHoverTip}
                            onClick={(e) => actionable && openActionModal(app, e)}
                            disabled={!actionable}
                            style={{
                              background: ss.bg,
                              border: `1px solid ${ss.border}`,
                              opacity: app.status === 'Cancelado' ? 0.5 : 1,
                              cursor: actionable ? 'pointer' : 'default',
                            }}
                          >
                            <div style={{ fontWeight: 700, textAlign: 'left' }}>{app.customer}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'left' }}>
                              {app.service}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                              <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                                R$ {Number(app.price).toFixed(2)}
                              </span>
                              <span
                                style={{
                                  background: ss.badge,
                                  color: app.status === 'Agendado' ? 'var(--text-secondary)' : '#fff',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  fontSize: '0.65rem',
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                }}
                              >
                                {ss.label}
                              </span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      {/* Desktop: grelha / tabela (visível só ≥769px via CSS) */}
      <div className="scheduler-grid-viewport">
      <div className="scheduler-grid-shell">
        {/* Time Column */}
        <div
          className="glass-card scheduler-time-col"
          style={{ paddingTop: `${dayHeaderHeight}px` }}
        >
          {STAFF_SCHEDULER_TIME_SLOTS.map((time, slotIdx) => (
            <div
              key={time}
              className="scheduler-time-col__slot"
              style={{ height: `${rowHeightsBySlot[slotIdx]}px` }}
            >
              <span className="scheduler-time-col__label">{time}</span>
            </div>
          ))}
        </div>

        {/* Calendar Main Grid */}
        <div
          className={`glass-card scheduler-calendar-panel${isDayGrid ? ' scheduler-calendar-panel--day-view' : ''}`}
        >
          <div
            style={{
              width: '100%',
              boxSizing: 'border-box',
              flexShrink: 0,
            }}
          >
          <div
            className="scheduler-desktop-week-header"
            style={{
              gridTemplateColumns: gridTemplateColumns,
              minHeight: `${dayHeaderHeight}px`,
              minWidth: isDayGrid ? 'min-content' : undefined,
            }}
          >
            {gridColumns.map((col) => {
              if (col.kind === 'barber') {
                const b = col.barber;
                return (
                  <div
                    key={col.key}
                    className="scheduler-desktop-week-header__cell scheduler-desktop-week-header__cell--barber"
                  >
                    <div
                      className="scheduler-desktop-week-header__barber-avatar"
                      aria-hidden
                    >
                      {b?.foto_perfil ? (
                        <img src={b.foto_perfil} alt="" />
                      ) : (
                        (b?.name || '?').charAt(0)
                      )}
                    </div>
                    <div className="scheduler-desktop-week-header__wd">
                      {b?.name?.split(' ')[0] || '—'}
                    </div>
                  </div>
                );
              }
              const dayLabel = getWeekdayLabelForIso(col.date);
              const isSelected = col.date === selectedDate;
              return (
                <button
                  key={col.key}
                  type="button"
                  className={`scheduler-desktop-week-header__cell${isSelected ? ' scheduler-desktop-week-header__cell--selected' : ''}`}
                  onClick={() => selectDesktopDay(col.date)}
                  aria-label={`${dayLabel}, ${formatSchedulerDatePt(col.date)}`}
                  aria-pressed={isSelected}
                >
                  <div className="scheduler-desktop-week-header__wd">{dayLabel}</div>
                  <div className="scheduler-desktop-week-header__num">{col.date.split('-').reverse()[0]}</div>
                </button>
              );
            })}
          </div>

          <div
            className="scheduler-calendar-grid-body"
            style={{
              display: 'grid',
              gridTemplateColumns: gridTemplateColumns,
              gridTemplateRows: rowHeightsBySlot.map((h) => `${h}px`).join(' '),
              gap: 0,
              width: '100%',
              minWidth: isDayGrid ? 'min-content' : undefined,
              position: 'relative',
              transition: 'grid-template-rows 0.25s ease',
            }}
          >
            {Array.from({ length: STAFF_SCHEDULER_TIME_SLOTS.length * gridColCount }).map((_, i) => {
              const colIndex = i % gridColCount;
              const rowIdx = Math.floor(i / gridColCount);
              const time = STAFF_SCHEDULER_TIME_SLOTS[rowIdx];
              const col = gridColumns[colIndex];
              const date = col.date;
              const columnBarberId = col.kind === 'barber' ? col.barberId : null;
              const cellApps = getAppointmentsForCell(date, time, columnBarberId);
              const gridRow = rowIdx + 1;
              const gridCol = colIndex + 1;
              const slotPast = isBookingSlotInPast(date, time);
              const slotOpenForBarber = (b, durationMinutes = 30) =>
                isBarberScheduleOpen({
                  barber: b,
                  dateIso: date,
                  time,
                  durationMinutes,
                });
              const showScheduleSlotPlus =
                !slotPast &&
                (columnBarberId != null
                  ? (() => {
                      const b =
                        col.barber ||
                        barbers.find((x) => String(x.id) === String(columnBarberId));
                      if (!b) return false;
                      const free = !cellHasBlockingAppointment(date, time, columnBarberId);
                      return free && slotOpenForBarber(b);
                    })()
                  : selectedBarberId === 'all'
                    ? activeBarbers.some((b) => {
                        const bid = String(b.id);
                        const notTaken = !cellHasBlockingAppointment(date, time, bid);
                        return notTaken && slotOpenForBarber(b);
                      })
                    : (() => {
                        const b = barbers.find((x) => String(x.id) === String(selectedBarberId));
                        if (!b) return false;
                        const free = !cellHasBlockingAppointment(date, time, selectedBarberId);
                        return free && slotOpenForBarber(b);
                      })());
              const blockBarberId =
                columnBarberId ?? (selectedBarberId !== 'all' ? selectedBarberId : null);
              const cellBlocked =
                slotPast ||
                (blockBarberId != null &&
                  cellHasBlockingAppointment(date, time, blockBarberId));
              const showMacroBars = col.kind === 'date';
              const showSingleCards = col.kind === 'barber';
              
              return (
                <div
                  key={i}
                  className="hover-trigger scheduler-grid-cell"
                  onClick={() => {
                    if (cellBlocked) return;
                    handleOpenModal(date, time);
                  }}
                  style={{
                    cursor: cellBlocked ? 'default' : 'pointer',
                    background: 'transparent',
                    gridColumn: gridCol,
                    gridRow: gridRow,
                  }}
                >
                  {showScheduleSlotPlus && (
                  <div className="hover-visible scheduler-grid-cell__plus" style={{ position: 'absolute', border: '1px dashed var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.01)', zIndex: 1 }}>
                    <Plus size={14} style={{ color: 'var(--text-secondary)' }} />
                  </div>
                  )}

                  <div
                    className={`scheduler-cell-appts ${apptCountClass(cellApps.length)}`}
                  >
                    
                    {/* Semana + Todos: vários barbeiros na mesma célula */}
                    {showMacroBars && cellApps.map((app) => {
                       const b = barbers.find((br) => br.id === app.barberId);
                       const actionable = app.status !== 'Finalizado' && app.status !== 'Cancelado';
                       return (
                         <SchedulerApptBar
                           key={app.id}
                           app={app}
                           barber={b}
                           statusStyle={getStatusStyle(app.status)}
                           stackCount={cellApps.length}
                           activeBarbers={activeBarbers}
                           variant="desktop"
                           onMouseEnter={onAppointmentHoverEnter(app, b?.name)}
                           onMouseLeave={clearAppointmentHoverTip}
                           onClick={(e) => actionable && openActionModal(app, e)}
                         />
                       );
                    })}

                    {/* Dia por coluna de barbeiro ou filtro individual */}
                    {showSingleCards && cellApps.map((app) => {
                        const ss = getStatusStyle(app.status);
                        const statusClass = getSchedulerStatusClass(app.status);
                        const actionable = app.status !== 'Finalizado' && app.status !== 'Cancelado';
                        return (
                          <div 
                            key={app.id}
                            role="button"
                            tabIndex={actionable ? 0 : -1}
                            className={`fade-in scheduler-cell-appts__single${statusClass ? ` ${statusClass}` : ''}`}
                            onMouseEnter={onAppointmentHoverEnter(
                              app,
                              barbers.find((x) => x.id === app.barberId)?.name
                            )}
                            onMouseLeave={clearAppointmentHoverTip}
                            onClick={(e) => actionable && openActionModal(app, e)}
                            style={{
                              pointerEvents: 'auto',
                              cursor: actionable ? 'pointer' : 'default',
                              ...(app.status === 'Cancelado'
                                ? { background: ss.bg, borderColor: ss.border }
                                : {}),
                            }}
                          >
                            <div style={{ overflow: 'hidden' }}>
                              <div style={{ fontWeight: 700, whiteSpace: 'nowrap', textOverflow: 'ellipsis', textDecoration: app.status === 'Cancelado' ? 'line-through' : 'none' }}>{app.customer}</div>
                              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{app.service}</div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '3px' }}>
                                <span style={{ fontWeight: 600, fontSize: '0.98rem', color: 'var(--text-primary)' }}>R$ {app.price}</span>
                                <div style={{ background: ss.badge, color: app.status === 'Agendado' ? 'var(--text-secondary)' : '#fff', padding: '3px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' }}>
                                  {ss.label}
                                </div>
                              </div>
                            </div>
                          </div>
                      )
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        </div>
      </div>
      </div>

      <AppointmentActionModal
        {...appointmentActions}
        services={services}
        products={products}
      />

      {/* ═══════ AGENDAMENTO MODAL ═══════ */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-glass-panel fade-in scheduler-modal-panel" style={{ width: '95%', maxWidth: '420px', padding: '1.75rem' }}>
            <div className="booking-reserve-form__title-row">
              <h2 className="booking-reserve-form__title">Reservar Horário</h2>
              <button type="button" className="booking-reserve-form__close" onClick={() => setIsModalOpen(false)} aria-label="Fechar">
                <X size={20} />
              </button>
            </div>

            <div className="booking-reserve-form">
              <input
                type="text"
                className="booking-reserve-form__field"
                placeholder="Buscar cliente cadastrado (nome ou telefone)"
                value={clientSearchQuery}
                onChange={(e) => {
                  setClientSearchQuery(e.target.value);
                  if (!e.target.value.trim()) {
                    setFormData((prev) => ({ ...prev, customerId: null }));
                  }
                }}
              />
              {clientSearchLoading && (
                <p className="booking-reserve-form__hint">Buscando clientes…</p>
              )}
              {!clientSearchLoading && clientSearchResults.length > 0 && (
                <ul
                  className="booking-reserve-form__client-suggestions"
                  style={{
                    listStyle: 'none',
                    margin: '0 0 8px',
                    padding: 0,
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    overflow: 'hidden',
                  }}
                >
                  {clientSearchResults.map((client) => (
                    <li key={`${client.source}-${client.id || client.guestKey}`}>
                      <button
                        type="button"
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '10px 12px',
                          border: 'none',
                          borderBottom: '1px solid var(--border-color)',
                          background: 'var(--panel-bg)',
                          cursor: 'pointer',
                        }}
                        onClick={() => selectCrmClient(client)}
                      >
                        <strong>{client.name}</strong>
                        {client.phone ? (
                          <span style={{ color: 'var(--text-secondary)', marginLeft: '8px', fontSize: '0.85rem' }}>
                            {client.phone}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <input
                type="text"
                className="booking-reserve-form__field"
                placeholder="Nome do cliente *"
                autoComplete="name"
                value={formData.customer}
                onChange={(e) => {
                  setBookingFormError(null);
                  setFormData({ ...formData, customer: e.target.value, customerId: null });
                }}
              />
              <input
                type="tel"
                className="booking-reserve-form__field"
                placeholder="Telefone (WhatsApp) *"
                autoComplete="tel"
                inputMode="tel"
                required
                value={formData.phone}
                onChange={(e) => {
                  setBookingFormError(null);
                  setFormData({ ...formData, phone: e.target.value, customerId: null });
                }}
              />
              <select
                className="booking-reserve-form__field"
                value={formData.serviceId}
                onChange={(e) => {
                  setBookingFormError(null);
                  setFormData({ ...formData, serviceId: e.target.value });
                }}
              >
                <option value="">Serviço *</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — R$ {s.price}
                  </option>
                ))}
              </select>
              {isBarber ? (
                <div className="booking-reserve-form__static">
                  Profissional: <strong style={{ color: 'var(--text-primary)' }}>{currentUser.name}</strong>
                </div>
              ) : (
                <select
                  className="booking-reserve-form__field"
                  value={formData.barberId}
                  onChange={(e) => {
                    setBookingFormError(null);
                    setFormData({ ...formData, barberId: e.target.value });
                  }}
                >
                  <option value="">Profissional *</option>
                  {activeBarbers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              )}
              <div className="booking-reserve-form__row">
                <input
                  type="date"
                  lang="pt-BR"
                  className="booking-reserve-form__field"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
                <select
                  className="booking-reserve-form__field"
                  value={
                    availableBookingTimes.length === 0
                      ? ''
                      : availableBookingTimes.includes(formData.time)
                        ? formData.time
                        : availableBookingTimes[0]
                  }
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  disabled={availableBookingTimes.length === 0}
                >
                  {availableBookingTimes.length === 0 ? (
                    <option value="">Sem horários disponíveis</option>
                  ) : (
                    availableBookingTimes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))
                  )}
                </select>
              </div>
              {bookingFormBarberId && availableBookingTimes.length === 0 && (
                <p className="booking-reserve-form__hint">
                  Não há horários livres neste dia para o profissional selecionado.
                </p>
              )}
              {bookingFormError && (
                <p className="booking-reserve-form__error" role="alert">
                  {bookingFormError}
                </p>
              )}
              <button
                type="button"
                className="btn-primary booking-reserve-form__submit"
                onClick={handleSaveAppointment}
              >
                Confirmar Reserva
              </button>
            </div>
          </div>
        </div>
      )}
      {appointmentHoverTip && (
        <div
          role="tooltip"
          className="scheduler-appointment-hover-tip"
          style={{ left: appointmentHoverTip.left, top: appointmentHoverTip.top }}
        >
          <div className="scheduler-appointment-hover-tip__icon" aria-hidden>
            <Plus size={14} strokeWidth={2.25} />
          </div>
          <p className="scheduler-appointment-hover-tip__line">
            {appointmentHoverTip.barberDisplayName} — {appointmentHoverTip.app.customer}{' '}
            <span className="scheduler-appointment-hover-tip__pill">
              ({getStatusStyle(appointmentHoverTip.app.status).label})
            </span>
          </p>
          <p className="scheduler-appointment-hover-tip__meta">{appointmentHoverTip.app.service}</p>
          <p className="scheduler-appointment-hover-tip__meta">
            {appointmentHoverTip.app.date.split('-').reverse().join('/')} · {appointmentHoverTip.app.time} · R${' '}
            {Number(appointmentHoverTip.app.price).toFixed(2)}
          </p>
        </div>
      )}
    </div>
  );
};

export default Scheduler;
