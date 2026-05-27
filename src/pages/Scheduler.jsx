import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus, Clock, User, Scissors, X, Calendar as CalendarIcon, Users } from 'lucide-react';
import AppointmentActionModal from '../components/appointments/AppointmentActionModal';
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
import { getAppointmentStatusStyle, isInServiceStatus } from '../utils/appointmentStatus';
import { STAFF_SCHEDULER_TIME_SLOTS } from '../utils/publicBookingSlots';
import { toIsoLocal } from '../utils/dateLocal';
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

/** Vibração curta para troca de dia (mobile); sem efeito onde `vibrate` não existe. */
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
  const debouncedClientSearch = useDebounce(clientSearchQuery, 300);

  const appointmentActions = useAppointmentActions({
    services,
    products,
    updateAppointmentStatus,
    cancelAppointment,
    sellProduct,
  });

  const schedulerWeekPickerRef = useRef(null);
  const appointmentHoverTimerRef = useRef(null);
  const pendingAppointmentHoverIdRef = useRef(null);
  const [appointmentHoverTip, setAppointmentHoverTip] = useState(null);

  const [isSchedulerNarrow, setIsSchedulerNarrow] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  );

  const [showSchedulerMonthPicker, setShowSchedulerMonthPicker] = useState(false);
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
    const phoneOk = String(formData.phone || '').replace(/\D/g, '').length >= 8;
    if (!formData.customer.trim() || !phoneOk || !formData.serviceId || !formData.barberId) return;
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

  const filteredAppointments = useMemo(() => {
    return appointments.filter(app => {
      const inRange = app.date >= startStr && app.date <= endStr;
      const matchesBarber = selectedBarberId === 'all' || String(app.barberId) === String(selectedBarberId);
      return inRange && matchesBarber;
    });
  }, [appointments, startStr, endStr, selectedBarberId]);

  const shiftDate = (daysCount) => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() + daysCount);
    setSelectedDate(toIsoLocal(d));
  };

  const getAppointmentsForCell = useCallback(
    (dateString, timeString) => {
      const slot = normalizeBookingTime(timeString);
      return filteredAppointments.filter(
        (app) => app.date === dateString && normalizeBookingTime(app.time) === slot
      );
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
    const weekBase = new Date(`${startStr}T12:00:00`);
    const weekDates = Array.from({ length: 7 }, (_, col) => {
      const d = new Date(weekBase);
      d.setDate(weekBase.getDate() + col);
      return toIsoLocal(d);
    });

    return STAFF_SCHEDULER_TIME_SLOTS.map((time) => {
      let maxCount = 0;
      for (const date of weekDates) {
        const n = filteredAppointments.filter(
          (a) => a.date === date && normalizeBookingTime(a.time) === normalizeBookingTime(time)
        ).length;
        if (n > maxCount) maxCount = n;
      }

      if (selectedBarberId !== 'all') {
        if (maxCount <= 1) return SCHEDULER_ROW_BASE_SINGLE;
        const inner = maxCount * SCHEDULER_SINGLE_CARD_H + (maxCount - 1) * 3;
        return Math.min(SCHEDULER_ROW_MAX_SINGLE, SCHEDULER_CELL_PAD + inner);
      }

      if (maxCount <= 1) return SCHEDULER_ROW_BASE_ALL;
      const inner = maxCount * SCHEDULER_APPT_MIN_H + (maxCount - 1) * SCHEDULER_APPT_GAP;
      return Math.min(SCHEDULER_ROW_MAX_ALL, SCHEDULER_CELL_PAD + inner);
    });
  }, [filteredAppointments, selectedBarberId, startStr, services]);

  const apptCountClass = (count) =>
    `scheduler-cell-appts--count-${Math.min(Math.max(count, 0), 9)}`;

  const getStatusStyle = getAppointmentStatusStyle;

  return (
    <div className="fade-in scheduler-page" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 4rem)' }}>
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
          {isSchedulerNarrow && (
            <div
              className="scheduler-mobile-day-chips scheduler-mobile-day-chips--header"
              role="tablist"
              aria-label="Dia da semana"
            >
              {days.map((dayLabel, i) => {
                const d = getDayDate(i);
                const active = d === selectedDate;
                return (
                  <button
                    key={d}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    data-scheduler-day={d}
                    className={`scheduler-mobile-day-chip${active ? ' scheduler-mobile-day-chip--active' : ''}`}
                    onClick={() => {
                      setSelectedDate(d);
                      softDayHaptic();
                    }}
                  >
                    <span className="scheduler-mobile-day-chip__wd">{dayLabel.slice(0, 3)}</span>
                    <span className="scheduler-mobile-day-chip__num">{d.split('-').reverse()[0]}</span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="scheduler-header-actions" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {!isSchedulerNarrow && (
              <div ref={schedulerWeekPickerRef} style={{ position: 'relative' }}>
                <div className="glass-card scheduler-week-picker-bar">
                  <button type="button" className="scheduler-week-picker-nav-btn" onClick={() => shiftDate(-7)} aria-label="Semana anterior">
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
                  <button type="button" className="scheduler-week-picker-nav-btn" onClick={() => shiftDate(7)} aria-label="Próxima semana">
                    <ChevronRight size={14} />
                  </button>
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
                              setSelectedDate(iso);
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
                          setSelectedDate(toIsoLocal(new Date()));
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
                className="btn-primary"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '8px', padding: '5px 6px', boxShadow: 'var(--shadow-md)' }}
                onClick={() => handleOpenModal()}
              >
                <Plus size={18} /> Agendar
              </button>
            )}
          </div>
        </div>

        {/* Barber Filters — only visible for managers */}
        {!isBarber && (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', overflowX: 'auto', paddingBottom: '5px', flexWrap: 'wrap' }} className="hide-scrollbar scheduler-barber-filters">
             <button 
               onClick={() => setSelectedBarberId('all')}
               style={{ 
                 display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '20px',
                 fontWeight: 600, fontSize: '0.85rem', flexShrink: 0,
                 transition: 'all 0.2s ease',
                 background: selectedBarberId === 'all' ? 'var(--accent-color)' : 'var(--hover-bg)',
                 color: selectedBarberId === 'all' ? 'var(--accent-text)' : 'var(--text-secondary)',
                 border: '1px solid #000'
               }}>
               <Users size={14} /> Todos
             </button>
             <div style={{ width: '1px', height: '24px', background: 'var(--border-color)', margin: '0 5px' }}></div>
             
             {activeBarbers.map(barber => (
               <button 
                 key={barber.id}
                 onClick={() => setSelectedBarberId(String(barber.id))}
                 style={{ 
                   display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px 6px 6px', borderRadius: '20px',
                   fontWeight: 600, fontSize: '0.85rem', flexShrink: 0,
                   transition: 'all 0.2s ease',
                   background: selectedBarberId === String(barber.id) ? 'var(--accent-color)' : 'var(--hover-bg)',
                   color: selectedBarberId === String(barber.id) ? 'var(--accent-text)' : 'var(--text-primary)',
                   border: '1px solid #000',
                   boxShadow: 'none'
                 }}>
                 <div style={{ width: '24px', height: '24px', borderRadius: '50%', overflow: 'hidden', background: selectedBarberId === String(barber.id) ? 'rgba(255, 255, 255, 0.45)' : 'var(--icon-bg)', color: selectedBarberId === String(barber.id) ? 'var(--accent-text)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>
                   {barber.foto_perfil ? <img src={barber.foto_perfil} alt={barber.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : barber.name.charAt(0)}
                 </div>
                 {barber.name.split(' ')[0]}
               </button>
             ))}
          </div>
        )}
      </header>

      {/* Mobile: lista rolável só do dia selecionado (selectedDate); chips da semana estão no header */}
      {isSchedulerNarrow && (
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
                          const ss = getStatusStyle(app.status);
                          return (
                            <button
                              key={app.id}
                              type="button"
                              className={`scheduler-mobile-macro-card scheduler-appt-bar scheduler-appt-bar--interactive${isInServiceStatus(app.status) ? ' scheduler-appt--in-service' : ''}`}
                              onMouseEnter={onAppointmentHoverEnter(app, b?.name)}
                              onMouseLeave={clearAppointmentHoverTip}
                              onClick={(e) => openActionModal(app, e)}
                              disabled={app.status === 'Finalizado' || app.status === 'Cancelado'}
                              style={{
                                background: ss.bg,
                                borderColor: ss.border,
                                opacity: app.status === 'Cancelado' ? 0.5 : 1,
                                cursor: app.status === 'Finalizado' || app.status === 'Cancelado' ? 'default' : 'pointer',
                                minHeight: '47px',
                                width: '100%',
                              }}
                            >
                              <span className="scheduler-appt-bar__accent" style={{ background: ss.badge }} aria-hidden />
                              <span
                                className={`scheduler-appt-bar__name${app.status === 'Cancelado' ? ' scheduler-appt-bar__name--cancelled' : ''}`}
                              >
                                {app.customer}
                              </span>
                              <span className="scheduler-appt-bar__meta">
                                {b?.name?.split(' ')[0]} · {ss.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      cellApps.map((app) => {
                        const ss = getStatusStyle(app.status);
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
                            onClick={(e) => openActionModal(app, e)}
                            disabled={app.status === 'Finalizado' || app.status === 'Cancelado'}
                            style={{
                              background: ss.bg,
                              border: `1px solid ${ss.border}`,
                              opacity: app.status === 'Cancelado' ? 0.5 : 1,
                              cursor:
                                app.status === 'Finalizado' || app.status === 'Cancelado'
                                  ? 'default'
                                  : 'pointer',
                            }}
                          >
                            <div style={{ fontWeight: 700, textAlign: 'left' }}>{app.customer}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'left' }}>{app.service}</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                              <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>R$ {app.price.toFixed(2)}</span>
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
      )}

      {/* Grid Container — desktop / tablet largo */}
      {!isSchedulerNarrow && (
      <div className="scheduler-grid-shell" style={{ flex: 1, display: 'grid', gridTemplateColumns: '80px 1fr', gap: '1rem', minHeight: 0, overflowY: 'auto' }}>
        
        {/* Time Column */}
        <div className="hide-scrollbar glass-card scheduler-time-col" style={{ padding: '0', display: 'flex', flexDirection: 'column', paddingTop: `${dayHeaderHeight}px`, background: 'rgba(0,0,0,0.02)', boxSizing: 'border-box', position: 'sticky', left: 0, zIndex: 20 }}>
          {STAFF_SCHEDULER_TIME_SLOTS.map((time, slotIdx) => (
            <div key={time} style={{ height: `${rowHeightsBySlot[slotIdx]}px`, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '10px', transition: 'height 0.25s ease', boxSizing: 'border-box' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{time}</span>
            </div>
          ))}
        </div>

        {/* Calendar Main Grid */}
        <div className="glass-card hide-scrollbar scheduler-calendar-panel" style={{ padding: '0', position: 'relative', overflowX: 'auto', overflowY: 'visible', display: 'flex', flexDirection: 'column' }}>
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
              gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
              minHeight: `${dayHeaderHeight}px`,
            }}
          >
            {days.map((day, i) => {
              const date = getDayDate(i);
              const isSelected = date === selectedDate;
              return (
                <div
                  key={day}
                  className={`scheduler-desktop-week-header__cell${isSelected ? ' scheduler-desktop-week-header__cell--selected' : ''}`}
                >
                  <div className="scheduler-desktop-week-header__wd">{day}</div>
                  <div className="scheduler-desktop-week-header__num">{date.split('-').reverse()[0]}</div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gridTemplateRows: rowHeightsBySlot.map((h) => `${h}px`).join(' '), gap: 0, width: '100%', position: 'relative', transition: 'grid-template-rows 0.25s ease' }}>
            
            {Array.from({ length: STAFF_SCHEDULER_TIME_SLOTS.length * 7 }).map((_, i) => {
              const col = i % 7;
              const rowIdx = Math.floor(i / 7);
              const time = STAFF_SCHEDULER_TIME_SLOTS[rowIdx];
              const date = getDayDate(col);
              const cellApps = getAppointmentsForCell(date, time);
              const gridRow = rowIdx + 1;
              const gridCol = col + 1;
              const slotPast = isBookingSlotInPast(date, time);
              const slotOpenForBarber = (b, durationMinutes = 30) =>
                isBarberScheduleOpen({
                  barber: b,
                  dateIso: date,
                  time,
                  durationMinutes,
                });
              /** Individual: só mostra "+" se o slot estiver livre e dentro da carga horária. */
              const showScheduleSlotPlus =
                !slotPast &&
                (selectedBarberId === 'all'
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
              const cellBlocked =
                slotPast ||
                (selectedBarberId !== 'all' &&
                  cellHasBlockingAppointment(date, time, selectedBarberId));
              
              return (
                <div 
                  key={i} 
                  className="hover-trigger"
                  onClick={() => {
                    if (cellBlocked) return;
                    handleOpenModal(date, time);
                  }}
                  style={{ 
                    borderRight: '1px solid var(--border-color)', 
                    boxShadow: 'inset 0 -1px 0 var(--border-color)',
                    position: 'relative',
                    cursor: cellBlocked ? 'default' : 'pointer',
                    background: 'transparent',
                    gridColumn: gridCol,
                    gridRow: gridRow,
                    padding: '2px',
                    boxSizing: 'border-box'
                  }}
                >
                  {showScheduleSlotPlus && (
                  <div className="hover-visible" style={{ position: 'absolute', inset: '2px', border: '1px dashed var(--border-color)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.01)', zIndex: 1 }}>
                    <Plus size={14} style={{ color: 'var(--text-secondary)' }} />
                  </div>
                  )}

                  <div
                    className={`scheduler-cell-appts ${apptCountClass(cellApps.length)}`}
                  >
                    
                    {/* ALL BARBERS view — barras com nome do cliente */}
                    {selectedBarberId === 'all' && cellApps.map(app => {
                       const b = barbers.find(b => b.id === app.barberId);
                       const ss = getStatusStyle(app.status);
                       const actionable = app.status !== 'Finalizado' && app.status !== 'Cancelado';
                       return (
                         <div
                           key={app.id}
                           role="button"
                           tabIndex={actionable ? 0 : -1}
                           className={`scheduler-appt-bar fade-in${actionable ? ' scheduler-appt-bar--interactive' : ' scheduler-appt-bar--muted'}${isInServiceStatus(app.status) ? ' scheduler-appt--in-service' : ''}`}
                           onMouseEnter={onAppointmentHoverEnter(app, b?.name)}
                           onMouseLeave={clearAppointmentHoverTip}
                           onClick={(e) => actionable && openActionModal(app, e)}
                           style={{
                             background: ss.bg,
                             borderColor: ss.border,
                           }}
                         >
                           <span className="scheduler-appt-bar__accent" style={{ background: ss.badge }} aria-hidden />
                           <span
                             className={`scheduler-appt-bar__name${app.status === 'Cancelado' ? ' scheduler-appt-bar__name--cancelled' : ''}`}
                             title={app.customer}
                           >
                             {app.customer}
                           </span>
                           {b?.name && (
                             <span className="scheduler-appt-bar__meta" title={b.name}>
                               {b.name.split(' ')[0]}
                             </span>
                           )}
                         </div>
                       );
                    })}

                    {/* SINGLE BARBER view */}
                    {selectedBarberId !== 'all' && cellApps.map(app => {
                        const ss = getStatusStyle(app.status);
                        const actionable = app.status !== 'Finalizado' && app.status !== 'Cancelado';
                        return (
                          <div 
                            key={app.id}
                            role="button"
                            tabIndex={actionable ? 0 : -1}
                            className={`fade-in scheduler-cell-appts__single${isInServiceStatus(app.status) ? ' scheduler-appt--in-service' : ''}`}
                            onMouseEnter={onAppointmentHoverEnter(
                              app,
                              barbers.find((x) => x.id === app.barberId)?.name
                            )}
                            onMouseLeave={clearAppointmentHoverTip}
                            onClick={(e) => actionable && openActionModal(app, e)}
                            style={{
                              flex: 1,
                              pointerEvents: 'auto',
                              background: ss.bg,
                              color: 'var(--text-primary)',
                              borderRadius: '12px',
                              padding: '10px',
                              fontSize: '0.91rem',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              border: `1px solid ${ss.border}`,
                              cursor: actionable ? 'pointer' : 'default',
                              opacity: app.status === 'Cancelado' ? 0.5 : 1,
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
      )}

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
                onChange={(e) => setFormData({ ...formData, customer: e.target.value, customerId: null })}
              />
              <input
                type="tel"
                className="booking-reserve-form__field"
                placeholder="Telefone (WhatsApp) *"
                autoComplete="tel"
                inputMode="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value, customerId: null })}
              />
              <select
                className="booking-reserve-form__field"
                value={formData.serviceId}
                onChange={(e) => setFormData({ ...formData, serviceId: e.target.value })}
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
                  onChange={(e) => setFormData({ ...formData, barberId: e.target.value })}
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
              <button
                type="button"
                className="btn-primary booking-reserve-form__submit"
                onClick={handleSaveAppointment}
                disabled={
                  !formData.customer.trim() ||
                  String(formData.phone || '').replace(/\D/g, '').length < 8 ||
                  !formData.serviceId ||
                  !formData.barberId ||
                  !formData.time ||
                  availableBookingTimes.length === 0 ||
                  !availableBookingTimes.includes(formData.time)
                }
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
