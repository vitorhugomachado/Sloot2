import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useTenant } from '../context/TenantContext';
import { isValidPhone, normalizePhone, PHONE_ERROR } from '../utils/phone';
import { requestCustomerPasswordReset } from '../utils/customerPasswordReset';
import { getPublicBookingSlotsForDay, hasBarberShiftOnDate } from '../utils/publicBookingSlots';
import { normalizeBookingTime } from '../utils/bookingAvailability';
import { toIsoLocal } from '../utils/dateLocal';

export { toIsoLocal } from '../utils/dateLocal';

export const INITIAL_VISIBLE_BOOKING_DAYS = 5;
export const LOAD_MORE_BOOKING_DAYS = 5;
export const MAX_BOOKING_HORIZON_DAYS = 60;

export function scrollBookingFlowToTop() {
  if (typeof window === 'undefined') return;
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  document.querySelector('.booking-preview--v2 .bp-flow__scroll')?.scrollTo({ top: 0, behavior: 'auto' });
}

/** Rolagem suave até o rodapé com o botão Continuar (passos serviço / barbeiro). */
export function scrollToContinueButton() {
  if (typeof window === 'undefined') return;
  const run = () => {
    const flow = document.querySelector('.booking-preview--v2 .bp-flow');
    const footer = flow?.querySelector('.bp-flow__footer');
    const target = footer ?? flow?.querySelector('.bp-btn-continuar');
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'nearest' });
  };
  requestAnimationFrame(() => requestAnimationFrame(run));
}

export function buildCalendarDays(monthDate) {
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

export function usePublicBookingFlow() {
  const { slug } = useTenant();
  const {
    barbers,
    services,
    appointments,
    addAppointment,
    businessInfo,
    currentCustomer,
    customerLogin,
    customerGoogleLogin,
    customerRegister,
    customerLogout,
  } = useApp();

  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState(() => toIsoLocal(new Date()));
  const [selectedService, setSelectedService] = useState(null);
  const [selectedBarber, setSelectedBarber] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [clientInfo, setClientInfo] = useState({ name: '', phone: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [authMode, setAuthMode] = useState('login');
  const [authData, setAuthData] = useState({ email: '', password: '', name: '', phone: '' });
  const [authError, setAuthError] = useState('');
  const [authInfo, setAuthInfo] = useState('');
  const [googleBusy, setGoogleBusy] = useState(false);
  const [forgotBusy, setForgotBusy] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [visibleDaysCount, setVisibleDaysCount] = useState(INITIAL_VISIBLE_BOOKING_DAYS);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const [year, month] = selectedDate.split('-').map(Number);
    return new Date(year, month - 1, 1);
  });

  const daySectionRefs = useRef({});
  const pendingScrollToDateRef = useRef(null);

  const activeBarbers = useMemo(
    () => barbers.filter((b) => b.role === 'Barbeiro' && b.status === 'Ativo'),
    [barbers],
  );

  const businessTitle = (businessInfo?.name || '').trim() || 'slooti';
  const durationMinutes = parseInt(String(selectedService?.duration), 10) || 0;

  useEffect(() => {
    setVisibleDaysCount(INITIAL_VISIBLE_BOOKING_DAYS);
  }, [selectedBarber?.id, selectedService?.id]);

  const { allWorkingDayIsosInHorizon, visibleBookingDateIsos } = useMemo(() => {
    const barbersForDays = selectedBarber ? [selectedBarber] : [];

    if (barbersForDays.length === 0) {
      return { allWorkingDayIsosInHorizon: [], visibleBookingDateIsos: [] };
    }

    const isoSet = new Set();
    const start = new Date();
    for (let offset = 0; offset < MAX_BOOKING_HORIZON_DAYS; offset += 1) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset);
      const iso = toIsoLocal(d);
      if (barbersForDays.some((b) => hasBarberShiftOnDate(b, iso))) isoSet.add(iso);
    }

    const workingIsos = [...isoSet].sort();
    const take = Math.min(visibleDaysCount, workingIsos.length);
    return {
      allWorkingDayIsosInHorizon: workingIsos,
      visibleBookingDateIsos: workingIsos.slice(0, take),
    };
  }, [selectedBarber, activeBarbers, visibleDaysCount]);

  const canLoadMore = visibleDaysCount < allWorkingDayIsosInHorizon.length;

  const scrollToDayCard = useCallback((dateIso) => {
    requestAnimationFrame(() => {
      const el = daySectionRefs.current[dateIso];
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  useEffect(() => {
    const iso = pendingScrollToDateRef.current;
    if (!iso || step !== 3) return;
    if (!visibleBookingDateIsos.includes(iso)) return;
    pendingScrollToDateRef.current = null;
    scrollToDayCard(iso);
  }, [visibleBookingDateIsos, step, scrollToDayCard]);

  const handleCalendarDaySelect = useCallback(
    (iso) => {
      const idx = allWorkingDayIsosInHorizon.indexOf(iso);
      if (idx === -1) return;

      setSelectedDate(iso);
      setShowDatePicker(false);

      if (visibleBookingDateIsos.includes(iso)) {
        scrollToDayCard(iso);
        return;
      }

      pendingScrollToDateRef.current = iso;
      setVisibleDaysCount((prev) => Math.max(prev, idx + 1));
    },
    [allWorkingDayIsosInHorizon, visibleBookingDateIsos, scrollToDayCard],
  );

  const goToStep = useCallback((nextStep) => {
    setStep(nextStep);
    requestAnimationFrame(() => {
      requestAnimationFrame(scrollBookingFlowToTop);
    });
  }, []);

  const pickService = (service) => {
    setSelectedService(service);
  };

  const selectServiceAndContinue = useCallback(
    (service) => {
      setSelectedService(service);
      goToStep(2);
    },
    [goToStep],
  );

  const confirmServiceStep = () => {
    if (!selectedService) return;
    goToStep(2);
  };

  const pickBarber = (barber) => {
    setSelectedBarber(barber);
    setSelectedTime(null);
  };

  const selectBarberAndContinue = useCallback(
    (barber) => {
      setSelectedBarber(barber);
      setSelectedTime(null);
      goToStep(3);
    },
    [goToStep],
  );

  const confirmBarberStep = () => {
    if (!selectedBarber) return;
    setSelectedTime(null);
    goToStep(3);
  };

  useEffect(() => {
    if (step !== 3 || !selectedBarber) return;
    if (allWorkingDayIsosInHorizon.length === 0) return;
    if (!allWorkingDayIsosInHorizon.includes(selectedDate)) {
      setSelectedDate(allWorkingDayIsosInHorizon[0]);
      setSelectedTime(null);
    }
  }, [step, selectedBarber, allWorkingDayIsosInHorizon, selectedDate]);

  const pickDate = (iso) => {
    setSelectedDate(iso);
    setSelectedTime(null);
  };

  const pickTime = (time) => {
    setSelectedTime(time);
  };

  const confirmDateTimeStep = () => {
    if (!selectedDate || !selectedTime) return;
    goToStep(4);
  };

  const resetBooking = () => {
    goToStep(1);
    setClientInfo({ name: '', phone: '' });
    setSelectedService(null);
    setSelectedBarber(null);
    setSelectedTime(null);
    setBookingError('');
  };

  const resolveBookingBarber = () => selectedBarber ?? null;

  const handleFinishBooking = async () => {
    const finalName = currentCustomer ? currentCustomer.name : clientInfo.name;
    const finalPhone = currentCustomer ? currentCustomer.phone : clientInfo.phone;
    const normalizedTime = normalizeBookingTime(selectedTime);

    if (!normalizedTime) {
      setBookingError('Horário inválido. Volte e escolha outro horário.');
      return;
    }

    const barberForBooking = resolveBookingBarber();
    if (!barberForBooking) {
      setBookingError('Nenhum profissional disponível neste horário. Escolha outro.');
      return;
    }

    const payload = {
      customer: finalName,
      phone: finalPhone,
      service: selectedService.name,
      barberId: barberForBooking.id,
      date: selectedDate,
      time: normalizedTime,
      status: 'Agendado',
      price: selectedService.price,
    };

    try {
      setIsSubmitting(true);
      setBookingError('');
      const result = await addAppointment(payload);
      if (result?.ok) {
        setStep(5);
      } else {
        setBookingError(result?.message || 'Não foi possível salvar o agendamento.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const openForgotPassword = useCallback(() => {
    setAuthError('');
    setAuthInfo('');
    setAuthMode('forgot');
  }, []);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthInfo('');

    if (authMode === 'forgot') {
      setForgotBusy(true);
      try {
        const message = await requestCustomerPasswordReset(authData.email, slug);
        setAuthInfo(message);
      } catch (err) {
        setAuthError(err.message);
      } finally {
        setForgotBusy(false);
      }
      return;
    }

    try {
      if (authMode === 'login') {
        await customerLogin(authData.email, authData.password);
      } else {
        if (!isValidPhone(authData.phone)) {
          setAuthError(PHONE_ERROR);
          return;
        }
        await customerRegister({
          email: authData.email.trim().toLowerCase(),
          password: authData.password,
          name: authData.name,
          phone: normalizePhone(authData.phone),
        });
      }
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleGoogleCustomerLogin = async () => {
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    setAuthError('');

    if (!googleClientId) {
      setAuthError('Configuração ausente: defina VITE_GOOGLE_CLIENT_ID no frontend.');
      return;
    }

    if (!window.google?.accounts?.id) {
      setAuthError('Google ainda não carregou. Tente novamente em instantes.');
      return;
    }

    setGoogleBusy(true);
    try {
      const credential = await new Promise((resolve, reject) => {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: (response) => {
            if (response?.credential) resolve(response.credential);
            else reject(new Error('Falha ao obter credencial Google'));
          },
        });

        window.google.accounts.id.prompt((notification) => {
          const skipped = notification.isSkippedMoment && notification.isSkippedMoment();
          const notDisplayed = notification.isNotDisplayed && notification.isNotDisplayed();
          if ((skipped || notDisplayed) && !notification.getDismissedReason?.()) {
            reject(new Error('Não foi possível abrir a janela do Google'));
          }
        });
      });

      await customerGoogleLogin(credential);
    } catch (err) {
      setAuthError(err.message || 'Erro no login com Google');
    } finally {
      setGoogleBusy(false);
    }
  };

  const getSlotsForDay = (dateIso) =>
    getPublicBookingSlotsForDay({
      dateIso,
      barber: selectedBarber,
      durationMinutes,
      appointments,
    });

  const monthLabel = calendarMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return {
    step,
    setStep,
    selectedDate,
    selectedService,
    selectedBarber,
    selectedTime,
    clientInfo,
    setClientInfo,
    isSubmitting,
    bookingError,
    authMode,
    setAuthMode,
    authData,
    setAuthData,
    authError,
    setAuthError,
    authInfo,
    googleBusy,
    forgotBusy,
    openForgotPassword,
    showDatePicker,
    setShowDatePicker,
    visibleDaysCount,
    setVisibleDaysCount,
    calendarMonth,
    setCalendarMonth,
    daySectionRefs,
    services,
    activeBarbers,
    businessInfo,
    businessTitle,
    currentCustomer,
    customerLogout,
    durationMinutes,
    allWorkingDayIsosInHorizon,
    visibleBookingDateIsos,
    canLoadMore,
    monthLabel,
    goToStep,
    pickService,
    selectServiceAndContinue,
    confirmServiceStep,
    pickBarber,
    selectBarberAndContinue,
    resolveBookingBarber,
    confirmBarberStep,
    pickDate,
    pickTime,
    confirmDateTimeStep,
    resetBooking,
    handleFinishBooking,
    handleAuthSubmit,
    handleGoogleCustomerLogin,
    handleCalendarDaySelect,
    getSlotsForDay,
    buildCalendarDays,
    toIsoLocal,
  };
}
