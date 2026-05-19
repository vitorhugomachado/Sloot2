import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Scissors, Calendar, Clock, Check, ChevronLeft, ChevronRight, User, Phone, Bell, LogIn } from 'lucide-react';
import { useApp } from '../context/AppContext';
import StripedMotionButton from '../components/StripedMotionButton';
import BusinessSocialLinks from '../components/BusinessSocialLinks';
import { isValidPhone, normalizePhone, PHONE_ERROR } from '../utils/phone';
import { getPublicBookingSlotsForDay, hasBarberShiftOnDate } from '../utils/publicBookingSlots';
import { normalizeBookingTime } from '../utils/bookingAvailability';

const INITIAL_VISIBLE_BOOKING_DAYS = 5;
const LOAD_MORE_BOOKING_DAYS = 5;
const MAX_BOOKING_HORIZON_DAYS = 60;

const PublicBooking = ({ onOpenPortal }) => {
  const { barbers, services, appointments, addAppointment, businessInfo, 
    currentCustomer, customerLogin, customerGoogleLogin, customerRegister, customerLogout } = useApp();
  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedBarber, setSelectedBarber] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [clientInfo, setClientInfo] = useState({ name: '', phone: '' });
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [redirectAfterLogin, setRedirectAfterLogin] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState('');

  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [authData, setAuthData] = useState({ email: '', password: '', name: '', phone: '' });
  const [authError, setAuthError] = useState('');
  const [googleBusy, setGoogleBusy] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [visibleDaysCount, setVisibleDaysCount] = useState(INITIAL_VISIBLE_BOOKING_DAYS);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const [year, month] = selectedDate.split('-').map(Number);
    return new Date(year, month - 1, 1);
  });
  const daySectionRefs = useRef({});
  const pendingScrollToDateRef = useRef(null);

  const scrollToDayCard = useCallback((dateIso) => {
    requestAnimationFrame(() => {
      const el = daySectionRefs.current[dateIso];
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  useEffect(() => {
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!googleClientId) return;

    const scriptId = 'google-identity-services-customer';
    if (document.getElementById(scriptId)) return;

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    setVisibleDaysCount(INITIAL_VISIBLE_BOOKING_DAYS);
  }, [selectedBarber?.id, selectedService?.id]);

  const monthLabel = calendarMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const buildCalendarDays = (monthDate) => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startWeekday = (firstOfMonth.getDay() + 6) % 7; // Monday-first
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];

    for (let i = 0; i < startWeekday; i += 1) days.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) days.push(new Date(year, month, day));
    while (days.length % 7 !== 0) days.push(null);

    return days;
  };

  const toIsoLocal = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const { allWorkingDayIsosInHorizon, visibleBookingDateIsos } = useMemo(() => {
    const barber = selectedBarber;
    if (!barber) {
      return { allWorkingDayIsosInHorizon: [], visibleBookingDateIsos: [] };
    }

    const workingIsos = [];
    const start = new Date();
    for (let offset = 0; offset < MAX_BOOKING_HORIZON_DAYS; offset += 1) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset);
      const iso = toIsoLocal(d);
      if (hasBarberShiftOnDate(barber, iso)) workingIsos.push(iso);
    }

    const take = Math.min(visibleDaysCount, workingIsos.length);
    return {
      allWorkingDayIsosInHorizon: workingIsos,
      visibleBookingDateIsos: workingIsos.slice(0, take),
    };
  }, [selectedBarber, visibleDaysCount]);

  useEffect(() => {
    const iso = pendingScrollToDateRef.current;
    if (!iso || step !== 3) return;
    if (!visibleBookingDateIsos.includes(iso)) return;
    pendingScrollToDateRef.current = null;
    scrollToDayCard(iso);
  }, [visibleBookingDateIsos, step, scrollToDayCard]);

  const handleCalendarDaySelect = (iso) => {
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
  };

  const businessTitle = (businessInfo && businessInfo.name ? businessInfo.name : '').trim() || 'SLOOT';

  const renderProgressBar = () => (
    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '3rem' }}>
      {[1, 2, 3, 4, 5].map(s => (
        <div key={s} style={{ 
          height: '4px', 
          width: '40px', 
          borderRadius: '2px', 
          background: step >= s ? 'var(--accent-color)' : 'var(--border-color)',
          transition: 'all 0.3s ease'
        }}></div>
      ))}
    </div>
  );

  const handleFinishBooking = async () => {
    const finalName = currentCustomer ? currentCustomer.name : clientInfo.name;
    const finalPhone = currentCustomer ? currentCustomer.phone : clientInfo.phone;
    const normalizedTime = normalizeBookingTime(selectedTime);

    if (!normalizedTime) {
      setBookingError('Horário inválido. Volte e escolha outro horário.');
      return;
    }

    const payload = {
      customer: finalName,
      phone: finalPhone,
      service: selectedService.name,
      barberId: selectedBarber.id,
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

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (authMode === 'login') {
        const user = await customerLogin(authData.email, authData.password);
        if (redirectAfterLogin) {
          setRedirectAfterLogin(false);
          onOpenPortal();
        }
      } else {
        if (!isValidPhone(authData.phone)) {
          setAuthError(PHONE_ERROR);
          return;
        }
        await customerRegister({
          email: authData.email.trim().toLowerCase(),
          password: authData.password,
          name: authData.name,
          phone: normalizePhone(authData.phone)
        });
        if (redirectAfterLogin) {
          setRedirectAfterLogin(false);
          onOpenPortal();
        }
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
          }
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

      if (redirectAfterLogin) {
        setRedirectAfterLogin(false);
        onOpenPortal();
      }
    } catch (err) {
      setAuthError(err.message || 'Erro no login com Google');
    } finally {
      setGoogleBusy(false);
    }
  };

  const renderStep = () => {
    switch(step) {
      case 1:
        return (
          <div className="fade-in">
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>O que vamos fazer hoje?</h2>
            <div style={{ display: 'grid', gap: '1rem' }}>
              {services.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', background: 'var(--panel-bg)', borderRadius: '12px', border: '1px solid #0a0a0a', boxSizing: 'border-box' }}>
                  Nenhum serviço disponível no momento.
                </div>
              ) : (
                services.map(s => (
                  <StripedMotionButton
                    key={s.id} 
                    stripeMode="subtle-always"
                    className="glass-card"
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      cursor: 'pointer',
                      width: '100%',
                      textAlign: 'left',
                      background: 'var(--surface-color)',
                      padding: '1.25rem'
                    }}
                    onClick={() => { 
                      setSelectedService(s); 
                      setStep(2); 
                    }}
                  >
                    <div>
                      <h3 style={{ fontSize: '1.1rem', marginBottom: '4px', color: 'var(--text-primary)' }}>{s.name}</h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{s.duration}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>R$ {s.price}</span>
                    </div>
                  </StripedMotionButton>
                ))
              )}
            </div>
          </div>
        );
      case 2:
        return (
          <div className="fade-in">
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Escolha seu barbeiro</h2>
            <div style={{ display: 'grid', gap: '1rem' }}>
              {barbers.filter(b => b.role === 'Barbeiro' && b.status === 'Ativo').length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', background: 'var(--panel-bg)', borderRadius: '12px', border: '1px solid #0a0a0a', boxSizing: 'border-box' }}>
                  Não há barbeiros disponíveis para agendamento online hoje.
                </div>
              ) : (
                barbers.filter(b => b.role === 'Barbeiro' && b.status === 'Ativo').map(b => (
                  <StripedMotionButton
                    key={b.id} 
                    className="glass-card" 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '1.5rem',
                      cursor: 'pointer',
                      background: 'var(--surface-color)',
                      padding: '1.25rem'
                    }}
                    onClick={() => { 
                      setSelectedBarber(b); 
                      setStep(3); 
                    }}
                  >
                    <div style={{ width: '60px', height: '60px', background: 'var(--icon-bg)', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 700, overflow: 'hidden', border: '1px solid #0a0a0a', boxSizing: 'border-box' }}>
                      {b.foto_perfil ? (
                        <img src={b.foto_perfil} alt={b.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        b.name.charAt(0)
                      )}
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', marginBottom: '4px' }}>{b.name}</h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{b.role}</p>
                    </div>
                    <ChevronRight size={20} style={{ marginLeft: 'auto', color: 'var(--text-secondary)' }} />
                  </StripedMotionButton>
                ))
              )}
            </div>
            <StripedMotionButton
              className="btn-secondary"
              style={{ marginTop: '2rem', display: 'block', marginLeft: 'auto', marginRight: 'auto' }}
              textStyle={{ color: 'var(--text-primary)', textShadow: 'none' }}
              onClick={() => setStep(1)}
            >
              Voltar
            </StripedMotionButton>
          </div>
        );
      case 3: {
        const durationMinutes = parseInt(String(selectedService?.duration), 10) || 0;
        const canLoadMore = visibleDaysCount < allWorkingDayIsosInHorizon.length;

        return (
          <div className="fade-in">
            <div className="glass-card" style={{ padding: '2rem', background: 'var(--surface-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'var(--icon-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid #0a0a0a', flexShrink: 0, boxSizing: 'border-box' }}>
                    {selectedBarber?.foto_perfil ? (
                      <img src={selectedBarber.foto_perfil} alt={selectedBarber.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontWeight: 'bold', fontSize: '1.25rem', color: 'var(--text-secondary)' }}>{selectedBarber?.name?.charAt(0)}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--text-primary)', lineHeight: 1.2 }}>{selectedBarber?.name}</span>
                    <StripedMotionButton type="button" style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: 'none', padding: 0 }} textStyle={{ color: 'var(--text-primary)', textShadow: 'none' }} onClick={() => setStep(2)}>
                       ⇄ Alterar
                    </StripedMotionButton>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '1.75rem', position: 'relative' }}>
                <div
                  className="booking-date-trigger"
                  onClick={() => setShowDatePicker((prev) => !prev)}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Selecione o dia
                    </div>
                  </div>
                  <div className="booking-icon-pill">
                    <Calendar size={20} strokeWidth={2.3} />
                  </div>
                </div>

                {showDatePicker && (
                  <div className="booking-calendar-popover">
                    <div className="booking-calendar-header">
                      <button
                        type="button"
                        className="booking-calendar-nav"
                        onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <strong style={{ textTransform: 'capitalize' }}>{monthLabel}</strong>
                      <button
                        type="button"
                        className="booking-calendar-nav"
                        onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                    <div className="booking-calendar-grid">
                      {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((day) => (
                        <span key={day} className="booking-calendar-weekday">{day}</span>
                      ))}
                      {buildCalendarDays(calendarMonth).map((day, idx) => {
                        if (!day) return <span key={`empty-${idx}`} className="booking-calendar-day empty" />;
                        const iso = toIsoLocal(day);
                        const isSelected = iso === selectedDate;
                        const isPast = iso < toIsoLocal(new Date());
                        const hasShift = hasBarberShiftOnDate(selectedBarber, iso);
                        return (
                          <button
                            key={iso}
                            type="button"
                            className={`booking-calendar-day ${isSelected ? 'selected' : ''}`}
                            disabled={isPast || !hasShift}
                            onClick={() => handleCalendarDaySelect(iso)}
                          >
                            {day.getDate()}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="booking-multi-day-list">
                {allWorkingDayIsosInHorizon.length === 0 ? (
                  <div className="booking-day-no-slots">
                    Este profissional não tem expediente configurado nos próximos {MAX_BOOKING_HORIZON_DAYS} dias.
                  </div>
                ) : (
                  visibleBookingDateIsos.map((dateIso) => {
                  const { slotsToDisplay, isWithinAnyShift, taken } = getPublicBookingSlotsForDay({
                    dateIso,
                    barber: selectedBarber,
                    durationMinutes,
                    appointments,
                  });

                  const parts = dateIso.split('-').map(Number);
                  const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
                  const weekdayLabel = dateObj.toLocaleDateString('pt-BR', { weekday: 'long' });
                  const weekdayCap = weekdayLabel.charAt(0).toUpperCase() + weekdayLabel.slice(1);
                  const dateRest = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

                  return (
                    <section
                      key={dateIso}
                      id={`booking-day-${dateIso}`}
                      ref={(el) => {
                        if (el) daySectionRefs.current[dateIso] = el;
                        else delete daySectionRefs.current[dateIso];
                      }}
                      className="booking-day-slot-section"
                    >
                      <p className="booking-slots-date-heading">
                        <span className="booking-slots-date-weekday">{weekdayCap}</span>
                        <span className="booking-slots-date-rest">, {dateRest}</span>
                      </p>

                      {slotsToDisplay.length === 0 ? (
                        <div className="booking-day-no-slots">
                          Nenhum horário disponível neste dia para este profissional.
                        </div>
                      ) : (
                        <div className="booking-slots-grid booking-slots-grid--public">
                          {slotsToDisplay.map((t) => {
                            const isSelectable = isWithinAnyShift(t) && !taken.has(t);
                            return (
                              <button
                                type="button"
                                className={`booking-slot-btn ${isSelectable ? 'booking-slot-btn--available' : 'booking-slot-btn--blocked'}`}
                                key={`${dateIso}-${t}`}
                                disabled={!isSelectable}
                                onClick={() => {
                                  if (!isSelectable) return;
                                  setSelectedDate(dateIso);
                                  setSelectedTime(t);
                                  setStep(4);
                                }}
                              >
                                <span className="booking-slot-icon-wrap" aria-hidden="true">
                                  <Clock size={14} strokeWidth={2} />
                                </span>
                                {t}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  );
                })
                )}
              </div>

              {canLoadMore && allWorkingDayIsosInHorizon.length > 0 && (
                <div className="booking-load-more-wrap">
                  <button
                    type="button"
                    className="booking-load-more-btn"
                    onClick={() =>
                      setVisibleDaysCount((c) =>
                        Math.min(c + LOAD_MORE_BOOKING_DAYS, allWorkingDayIsosInHorizon.length)
                      )
                    }
                  >
                    Ver mais
                  </button>
                </div>
              )}
            </div>
            <StripedMotionButton className="btn-secondary" style={{ marginTop: '1.25rem', display: 'block', marginLeft: 'auto', marginRight: 'auto' }} textStyle={{ color: 'var(--text-primary)', textShadow: 'none' }} onClick={() => setStep(2)}>
              Voltar
            </StripedMotionButton>
          </div>
        );
      }
      case 4:
        return (
          <div className="fade-in">
            {!currentCustomer ? (
              <div className="glass-card" style={{ padding: '2.5rem' }}>
                <h2 style={{ fontSize: '1.4rem', marginBottom: '0.5rem', textAlign: 'center' }}>
                  {authMode === 'login' ? 'Acesse sua conta' : 'Crie sua conta'}
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', marginBottom: '2rem' }}>
                  Para confirmar seu agendamento, precisamos te identificar.
                </p>

                <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {authMode === 'register' && (
                    <>
                      <input 
                        type="text" placeholder="Nome Completo" required
                        value={authData.name} onChange={e => setAuthData({...authData, name: e.target.value})}
                        style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', outline: 'none' }} 
                      />
                      <input
                        type="tel" placeholder="WhatsApp (DDD) 00000-0000" required
                        inputMode="numeric" autoComplete="tel"
                        value={authData.phone} onChange={e => setAuthData({...authData, phone: e.target.value})}
                        style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', outline: 'none' }}
                      />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '-4px' }}>
                        DDD + número (10 ou 11 dígitos). Ex.: 11912345678.
                      </span>
                    </>
                  )}
                  <input 
                    type="email" placeholder="Seu E-mail" required
                    value={authData.email} onChange={e => setAuthData({...authData, email: e.target.value})}
                    style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', outline: 'none' }} 
                  />
                  <input 
                    type="password" placeholder="Sua Senha" required
                    value={authData.password} onChange={e => setAuthData({...authData, password: e.target.value})}
                    style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', outline: 'none' }} 
                  />
                  
                  {authError && <p style={{ color: '#ef4444', fontSize: '0.85rem', textAlign: 'center' }}>{authError}</p>}
                  
                  <StripedMotionButton type="submit" className="btn-primary" style={{ padding: '14px', marginTop: '0.5rem', width: '100%' }}>
                    {authMode === 'login' ? 'Entrar e Continuar' : 'Cadastrar e Continuar'}
                  </StripedMotionButton>

                  {authMode === 'login' && (
                    <>
                      <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                        ou
                      </div>
                      <button
                        type="button"
                        className="google-signin-btn"
                        onClick={handleGoogleCustomerLogin}
                        disabled={googleBusy}
                      >
                        <svg className="google-signin-btn__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" aria-hidden>
                          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C43.68 37.08 46.98 31.38 46.98 24.55z" />
                          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                        </svg>
                        <span>{googleBusy ? 'Conectando…' : 'Entrar com Google'}</span>
                      </button>
                    </>
                  )}
                </form>

                <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                  <StripedMotionButton
                    onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError(''); }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '0.9rem', cursor: 'pointer', fontWeight: 600, boxShadow: 'none', padding: 0 }}
                    textStyle={{ color: 'var(--text-primary)', textShadow: 'none' }}
                  >
                    {authMode === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Faça login'}
                  </StripedMotionButton>
                </div>
              </div>
            ) : (
              <div className="glass-card" style={{ padding: '2.5rem' }}>
                <h2 style={{ fontSize: '1.4rem', marginBottom: '1.5rem' }}>Confirmar Agendamento</h2>
                
                <div className="booking-auth-summary-card" style={{ background: 'var(--panel-bg)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem' }}>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Logado como:</p>
                  <p style={{ fontWeight: 700, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <User size={18} /> {currentCustomer?.name || 'Cliente'}
                  </p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{currentCustomer?.email || ''}</p>
                  
                  <StripedMotionButton
                    onClick={customerLogout}
                    style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.8rem', cursor: 'pointer', marginTop: '12px', padding: 0, boxShadow: 'none' }}
                    textStyle={{ color: '#ef4444', textShadow: 'none' }}
                  >
                    (Sair da conta)
                  </StripedMotionButton>
                </div>

                <div style={{ marginBottom: '2rem' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Resumo da Reserva</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Serviço:</span>
                      <span style={{ fontWeight: 600 }}>{selectedService?.name}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Barbeiro:</span>
                      <span style={{ fontWeight: 600 }}>{selectedBarber?.name}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Data/Hora:</span>
                      <span style={{ fontWeight: 600 }}>{selectedDate?.split('-')?.reverse()?.join('/')} às {selectedTime}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--border-color)' }}>
                      <span style={{ fontWeight: 700 }}>Total:</span>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>R$ {selectedService?.price.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {bookingError ? (
                  <p role="alert" style={{ color: '#dc2626', fontSize: '0.9rem', marginBottom: '12px', textAlign: 'center' }}>
                    {bookingError}
                  </p>
                ) : null}
                <StripedMotionButton
                  className="btn-primary" 
                  style={{ width: '100%', padding: '16px', fontSize: '1rem', fontWeight: 700 }}
                  isLoading={isSubmitting}
                  loadingText="Processando agendamento..."
                  onClick={handleFinishBooking}
                >
                  Finalizar e Agendar
                </StripedMotionButton>
              </div>
            )}
            <StripedMotionButton className="btn-secondary" style={{ marginTop: '2rem', display: 'block', marginLeft: 'auto', marginRight: 'auto' }} textStyle={{ color: 'var(--text-primary)', textShadow: 'none' }} onClick={() => setStep(3)}>Voltar</StripedMotionButton>
          </div>
        );
      case 5:
        return (
          <div className="fade-in" style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div
              style={{
                background: 'rgba(5, 150, 105, 0.14)',
                color: 'var(--success-color)',
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 2rem',
              }}
            >
              <Check size={40} strokeWidth={2.4} aria-hidden />
            </div>
            <h2 style={{ fontSize: '1.8rem', marginBottom: '1rem' }}>Pronto, {(currentCustomer?.name || clientInfo?.name || '').split(' ')[0]}!</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>Seu agendamento foi realizado com sucesso.</p>
            {!currentCustomer ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '2.5rem', maxWidth: '360px', marginLeft: 'auto', marginRight: 'auto' }}>
                Para ver este agendamento em &quot;Meus agendamentos&quot;, faça login com o mesmo e-mail usado na reserva.
              </p>
            ) : (
              <p style={{ marginBottom: '2.5rem' }} aria-hidden="true" />
            )}
            
            <div className="glass-card" style={{ display: 'inline-block', textAlign: 'left', minWidth: '320px', marginBottom: '2.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Serviço</span>
                <span style={{ fontWeight: 600 }}>{selectedService?.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Barbeiro</span>
                <span style={{ fontWeight: 600 }}>{selectedBarber?.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Data</span>
                <span style={{ fontWeight: 600 }}>{selectedDate?.split('-').reverse().join('/')}, às {selectedTime}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Valor</span>
                <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{selectedService?.price}</span>
              </div>
            </div>
            
            <div
              className="booking-success-actions"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '12px',
                justifyContent: 'center',
                maxWidth: '520px',
                margin: '0 auto',
                padding: '0 0.5rem',
              }}
            >
              <StripedMotionButton
                type="button"
                className="btn-primary"
                style={{ flex: '1 1 200px', minWidth: 0, padding: '14px 20px' }}
                onClick={() => {
                  setStep(1);
                  setClientInfo({ name: '', phone: '' });
                  setSelectedService(null);
                  setSelectedBarber(null);
                  setSelectedTime(null);
                }}
              >
                Fazer outro agendamento
              </StripedMotionButton>
              <StripedMotionButton
                type="button"
                className="btn-primary"
                style={{ flex: '1 1 200px', minWidth: 0, padding: '14px 20px' }}
                onClick={() => onOpenPortal()}
              >
                Meus agendamentos
              </StripedMotionButton>
            </div>
          </div>
        );
      default: return null;
    }
  }

  return (
    <div className="public-booking-page" style={{ 
      minHeight: '100vh', 
      background: 'var(--bg-color)',
      paddingBottom: '4rem'
    }}>
      {/* Top Navbar */}
      <nav style={{ 
        background: '#000000', 
        padding: '0.75rem 2rem', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#FFFDF2', fontWeight: 700, fontSize: '1.1rem' }}>
          {businessInfo && businessInfo.logo_url ? (
            <img src={businessInfo.logo_url} alt="Logo" style={{ height: '32px', width: '32px', borderRadius: '6px', objectFit: 'contain', background: 'white' }} />
          ) : null}
          <span className="sloot-logo-text" style={{ fontSize: '1.2rem', color: '#FFFDF2', paddingTop: '2px' }}>SLOOT</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', color: '#FFFDF2' }}>
          
          <StripedMotionButton
            onClick={() => {
              if (currentCustomer) {
                onOpenPortal();
              } else {
                setRedirectAfterLogin(true);
                setStep(4);
              }
            }}
            style={{ 
              background: 'rgba(255,255,255,0.1)', 
              color: '#FFFDF2', 
              border: '1px solid rgba(255,255,255,0.3)',
              padding: '6px 14px',
              borderRadius: '9999px',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
            textStyle={{ color: '#FFFDF2' }}
          >
            <Calendar size={14} /> Minha Agenda
          </StripedMotionButton>

          <div style={{ position: 'relative', cursor: 'pointer' }}>
            <Bell size={24} />
          </div>
          <div 
            style={{ position: 'relative', cursor: 'pointer' }}
            onClick={() => setShowAccountMenu(!showAccountMenu)}
          >
            <div style={{ 
              width: '36px', 
              height: '36px', 
              borderRadius: '50%', 
              background: 'rgba(255,255,255,0.2)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <User size={22} />
            </div>

            {/* Account Dropdown Card */}
            {showAccountMenu && (
              <div 
                className="glass-card fade-in"
                style={{ 
                  position: 'absolute', 
                  top: '45px', 
                  right: 0, 
                  width: '200px', 
                  padding: '1rem',
                  background: 'white',
                  borderRadius: '12px',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                  color: 'var(--text-primary)',
                  zIndex: 200
                }}
              >
                {!currentCustomer ? (
                  <StripedMotionButton
                    onClick={() => { setStep(4); setShowAccountMenu(false); }}
                    style={{ 
                      width: '100%', 
                      padding: '10px', 
                      background: 'var(--accent-color)', 
                      color: 'var(--accent-text)', 
                      border: 'none', 
                      borderRadius: '9999px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                    textStyle={{ color: 'var(--accent-text)' }}
                  >
                    <LogIn size={18} /> ENTRAR
                  </StripedMotionButton>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
                      Olá, {currentCustomer?.name?.split(' ')[0] || 'Cliente'}
                    </div>
                    <StripedMotionButton
                      onClick={() => { onOpenPortal(); setShowAccountMenu(false); }}
                      style={{ 
                        width: '100%', padding: '8px', background: 'var(--brand-50)', color: 'var(--brand-700)', 
                        border: 'none', borderRadius: '9999px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600
                      }}
                      textStyle={{ color: 'var(--brand-700)', textShadow: 'none' }}
                    >
                      Minha Agenda
                    </StripedMotionButton>
                    <StripedMotionButton
                      onClick={() => { customerLogout(); setShowAccountMenu(false); }}
                      style={{ 
                        width: '100%', padding: '8px', background: 'none', color: 'var(--error-color, #ef4444)', 
                        border: 'none', borderRadius: '9999px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600
                      }}
                      textStyle={{ color: 'var(--error-color, #ef4444)', textShadow: 'none' }}
                    >
                      Sair
                    </StripedMotionButton>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: '600px', margin: '1rem auto 0', padding: '0 1rem' }}>
        <header style={{ textAlign: 'center', marginBottom: '2rem' }}>
          {businessInfo && businessInfo.logo_url ? (
            <img src={businessInfo.logo_url} alt="Logo" style={{ maxHeight: '100px', maxWidth: '200px', marginBottom: '1rem', borderRadius: '12px' }} />
          ) : null}
          <h1 className="booking-business-name" aria-label={businessTitle}>
            {businessTitle.split('').map((char, idx) => (
              <span key={`${char}-${idx}`} className="booking-business-letter">
                {char === ' ' ? '\u00A0' : char}
              </span>
            ))}
          </h1>
          <BusinessSocialLinks businessInfo={businessInfo} />
        </header>

        {step < 5 && renderProgressBar()}

        {renderStep()}
      </div>
    </div>
  );
};

export default PublicBooking;
