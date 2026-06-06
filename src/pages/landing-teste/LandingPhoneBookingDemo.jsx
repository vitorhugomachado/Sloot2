import BookingPreviewServiceStep from '../preview/BookingPreviewServiceStep';
import BookingPreviewBarberStep from '../preview/BookingPreviewBarberStep';
import BookingPreviewDateTimeStep from '../preview/BookingPreviewDateTimeStep';
import BookingPreviewSummaryStep from '../preview/BookingPreviewSummaryStep';
import BookingPreviewSuccessStep from '../preview/BookingPreviewSuccessStep';
import LandingPhoneDemoIntroCard from './LandingPhoneDemoIntroCard';
import { useLandingPhoneDemoFlow } from './useLandingPhoneDemoFlow';
import '../preview/booking-preview.css';
import '../preview/booking-preview-v2.css';
import './landing-phone-demo-intro.css';

const noop = () => {};

export default function LandingPhoneBookingDemo() {
  const flow = useLandingPhoneDemoFlow();
  const {
    step,
    showIntro,
    selectedService,
    selectedBarber,
    selectedDate,
    selectedTime,
    isSubmitting,
    services,
    activeBarbers,
    currentCustomer,
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
  } = flow;

  const wrapClass = 'booking-preview booking-preview--v2 booking-preview--embed';

  const renderStep = () => {
    if (step === 5) {
      return (
        <>
          <BookingPreviewSuccessStep
            selectedService={selectedService}
            selectedBarber={selectedBarber}
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            onNewBooking={resetDemo}
            onOpenPortal={noop}
          />
          <p className="lt-phone__demo-reset-hint" aria-live="polite">
            Reiniciando demonstração em alguns segundos…
          </p>
        </>
      );
    }

    if (step === 1) {
      return (
        <BookingPreviewServiceStep
          services={services}
          selectedService={selectedService}
          onPickService={pickService}
          onContinue={confirmServiceStep}
        />
      );
    }

    if (step === 2) {
      return (
        <BookingPreviewBarberStep
          barbers={activeBarbers}
          selectedBarber={selectedBarber}
          onPickBarber={pickBarber}
          onBack={() => goToStep(1)}
          onContinue={confirmBarberStep}
        />
      );
    }

    if (step === 3) {
      return (
        <BookingPreviewDateTimeStep
          workingDayIsos={allWorkingDayIsosInHorizon}
          selectedBarber={selectedBarber}
          selectedDate={selectedDate}
          selectedTime={selectedTime}
          onPickDate={pickDate}
          onPickTime={pickTime}
          onBack={() => goToStep(2)}
          onContinue={confirmDateTimeStep}
          getSlotsForDay={getSlotsForDay}
        />
      );
    }

    if (step === 4) {
      return (
        <BookingPreviewSummaryStep
          services={services}
          selectedService={selectedService}
          selectedBarber={selectedBarber}
          selectedDate={selectedDate}
          selectedTime={selectedTime}
          currentCustomer={currentCustomer}
          authMode="login"
          setAuthMode={noop}
          authData={{ email: '', password: '', name: '', phone: '' }}
          setAuthData={noop}
          authError=""
          authInfo=""
          googleBusy={false}
          forgotBusy={false}
          openForgotPassword={noop}
          bookingError=""
          isSubmitting={isSubmitting}
          onAuthSubmit={(e) => e.preventDefault()}
          onGoogleLogin={noop}
          onBack={() => goToStep(3)}
          onConfirm={confirmBooking}
          onEditStep={goToStep}
        />
      );
    }

    return null;
  };

  return (
    <div className={wrapClass}>
      {renderStep()}
      {showIntro && step !== 5 ? (
        <LandingPhoneDemoIntroCard onStart={dismissIntro} onClose={dismissIntro} />
      ) : null}
    </div>
  );
}
