import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { toIsoLocal } from '../../utils/dateLocal';
import {
  DEMO_SERVICES,
  DEMO_BARBERS,
  DEMO_TIME_SLOTS,
  DEMO_CUSTOMER,
  getDemoWorkingDayIsos,
} from './landingPhoneDemo.config';

const RESET_DELAY_MS = 10_000;
const SUBMIT_FEEDBACK_MS = 400;

export function useLandingPhoneDemoFlow() {
  const allWorkingDayIsosInHorizon = useMemo(() => getDemoWorkingDayIsos(5), []);

  const [step, setStep] = useState(1);
  const [showIntro, setShowIntro] = useState(true);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedBarber, setSelectedBarber] = useState(null);
  const [selectedDate, setSelectedDate] = useState(() => allWorkingDayIsosInHorizon[0] || toIsoLocal(new Date()));
  const [selectedTime, setSelectedTime] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const resetTimerRef = useRef(null);

  const goToStep = useCallback((nextStep) => {
    setStep(nextStep);
  }, []);

  const resetDemo = useCallback(() => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
    setStep(1);
    setShowIntro(true);
    setSelectedService(null);
    setSelectedBarber(null);
    setSelectedDate(allWorkingDayIsosInHorizon[0] || toIsoLocal(new Date()));
    setSelectedTime(null);
    setIsSubmitting(false);
  }, [allWorkingDayIsosInHorizon]);

  useEffect(() => {
    if (step !== 5) return undefined;
    resetTimerRef.current = setTimeout(resetDemo, RESET_DELAY_MS);
    return () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
        resetTimerRef.current = null;
      }
    };
  }, [step, resetDemo]);

  const pickService = (service) => setSelectedService(service);

  const confirmServiceStep = () => {
    if (!selectedService) return;
    goToStep(2);
  };

  const pickBarber = (barber) => {
    setSelectedBarber(barber);
    setSelectedTime(null);
  };

  const confirmBarberStep = () => {
    if (!selectedBarber) return;
    setSelectedTime(null);
    if (allWorkingDayIsosInHorizon.length > 0 && !allWorkingDayIsosInHorizon.includes(selectedDate)) {
      setSelectedDate(allWorkingDayIsosInHorizon[0]);
    }
    goToStep(3);
  };

  const pickDate = (iso) => {
    setSelectedDate(iso);
    setSelectedTime(null);
  };

  const pickTime = (time) => setSelectedTime(time);

  const confirmDateTimeStep = () => {
    if (!selectedDate || !selectedTime) return;
    goToStep(4);
  };

  const getSlotsForDay = useCallback(
    (dateIso) => {
      const isWorkingDay = allWorkingDayIsosInHorizon.includes(dateIso);
      const isWithinAnyShift = () => true;
      if (!isWorkingDay) {
        return { slotsToDisplay: [], isWithinAnyShift, taken: new Set() };
      }
      return {
        slotsToDisplay: [...DEMO_TIME_SLOTS],
        isWithinAnyShift,
        taken: new Set(),
      };
    },
    [allWorkingDayIsosInHorizon],
  );

  const confirmBooking = useCallback(async () => {
    setIsSubmitting(true);
    await new Promise((resolve) => {
      setTimeout(resolve, SUBMIT_FEEDBACK_MS);
    });
    setIsSubmitting(false);
    setStep(5);
  }, []);

  const dismissIntro = useCallback(() => {
    setShowIntro(false);
  }, []);

  return {
    step,
    showIntro,
    selectedService,
    selectedBarber,
    selectedDate,
    selectedTime,
    isSubmitting,
    services: DEMO_SERVICES,
    activeBarbers: DEMO_BARBERS,
    currentCustomer: DEMO_CUSTOMER,
    allWorkingDayIsosInHorizon,
    goToStep,
    pickService,
    confirmServiceStep,
    pickBarber,
    confirmBarberStep,
    pickDate,
    pickTime,
    confirmDateTimeStep,
    confirmBooking,
    resetDemo,
    dismissIntro,
    getSlotsForDay,
  };
}
