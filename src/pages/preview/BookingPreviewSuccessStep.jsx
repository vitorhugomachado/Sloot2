import React from 'react';
import {
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Scissors,
  ShieldCheck,
} from 'lucide-react';

function formatBookingDate(isoDate) {
  if (!isoDate) return '—';
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3) return isoDate;
  const [y, m, d] = parts;
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

export default function BookingPreviewSuccessStep({
  selectedService,
  selectedBarber,
  selectedDate,
  selectedTime,
  onNewBooking,
  onOpenPortal,
}) {
  const barberPhoto = selectedBarber?.foto_perfil;
  const barberInitial = selectedBarber?.name?.charAt(0)?.toUpperCase() || '?';

  return (
    <section className="bp-success" aria-labelledby="bp-success-title">
      <div className="bp-success__card">
        <header className="bp-success__hero">
          <div className="bp-success__icon-stage" aria-hidden>
            <span className="bp-success__spark bp-success__spark--1" />
            <span className="bp-success__spark bp-success__spark--2" />
            <span className="bp-success__spark bp-success__spark--3" />
            <span className="bp-success__spark bp-success__spark--4" />
            <div className="bp-success__icon">
              <Check size={36} strokeWidth={2.5} />
            </div>
          </div>
          <h2 id="bp-success-title" className="bp-success__title">
            Agendamento confirmado!
          </h2>
          <p className="bp-success__subtitle">
            Tudo certo! Seu horário foi agendado com sucesso.
          </p>
        </header>

        <div className="bp-success__details">
          <div className="bp-success__service-row">
            <span className="bp-success__detail-icon" aria-hidden>
              <Scissors size={20} strokeWidth={2} />
            </span>
            <div className="bp-success__detail-text">
              <span className="bp-success__detail-label">Serviço</span>
              <span className="bp-success__detail-value">{selectedService?.name || '—'}</span>
            </div>
          </div>

          <div className="bp-success__meta-grid">
            <div className="bp-success__meta-item">
              <span
                className={`bp-success__detail-icon${barberPhoto ? ' bp-success__detail-icon--photo' : ' bp-success__detail-icon--initial'}`}
                aria-hidden
              >
                {barberPhoto ? (
                  <img src={barberPhoto} alt="" />
                ) : (
                  <span className="bp-success__detail-initial">{barberInitial}</span>
                )}
              </span>
              <div className="bp-success__detail-text">
                <span className="bp-success__detail-label">Profissional</span>
                <span className="bp-success__detail-value">{selectedBarber?.name || '—'}</span>
              </div>
            </div>
            <div className="bp-success__meta-item">
              <span className="bp-success__detail-icon" aria-hidden>
                <Calendar size={18} strokeWidth={2} />
              </span>
              <div className="bp-success__detail-text">
                <span className="bp-success__detail-label">Data</span>
                <span className="bp-success__detail-value">{formatBookingDate(selectedDate)}</span>
              </div>
            </div>
            <div className="bp-success__meta-item">
              <span className="bp-success__detail-icon" aria-hidden>
                <Clock size={18} strokeWidth={2} />
              </span>
              <div className="bp-success__detail-text">
                <span className="bp-success__detail-label">Horário</span>
                <span className="bp-success__detail-value">{selectedTime || '—'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bp-success__actions">
          <button type="button" className="bp-success__btn bp-success__btn--primary" onClick={onNewBooking}>
            <span>Novo agendamento</span>
            <ChevronRight size={20} strokeWidth={2.5} aria-hidden />
          </button>
          <button type="button" className="bp-success__btn bp-success__btn--secondary" onClick={onOpenPortal}>
            <span>Minha agenda</span>
            <ChevronRight size={20} strokeWidth={2.5} aria-hidden />
          </button>
        </div>

        <footer className="bp-success__security" role="status">
          <span className="bp-success__security-icon" aria-hidden>
            <ShieldCheck size={22} strokeWidth={2} />
          </span>
          <div className="bp-success__security-text">
            <p className="bp-success__security-title">Seus dados estão protegidos e seguros.</p>
            <p className="bp-success__security-desc">
              Utilizamos criptografia para garantir sua privacidade.
            </p>
          </div>
        </footer>
      </div>
    </section>
  );
}
