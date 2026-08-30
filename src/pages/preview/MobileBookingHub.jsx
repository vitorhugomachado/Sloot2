import React, { useMemo, useState } from 'react';
import {
  CalendarDays,
  CircleUserRound,
  Clock3,
  Image as ImageIcon,
  MapPin,
  Scissors,
  Share2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useTenant } from '../../context/TenantContext';
import { filterBookableProfessionals } from '../../utils/bookableProfessionals';
import { groupWeeklyHours } from '../../utils/bookingPage';
import './mobile-booking-hub.css';

function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function duration(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.toLowerCase().includes('min') ? text : `${text} min`;
}

function initials(name) {
  return String(name || 'P').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

export default function MobileBookingHub({
  config: configProp,
  onStartBooking = () => {},
  onOpenAccount = () => {},
  accountLabel = 'Conta',
  interactive = true,
  businessInfo: businessInfoProp,
}) {
  const { slug } = useTenant();
  const { businessInfo: contextBusinessInfo, services, barbers } = useApp();
  const businessInfo = businessInfoProp || contextBusinessInfo;
  const [toast, setToast] = useState('');
  const [coverFailed, setCoverFailed] = useState(false);
  const config = configProp || businessInfo?.bookingPage || {};

  const professionals = useMemo(() => filterBookableProfessionals(barbers || []), [barbers]);
  const featuredServices = (services || []).slice(0, 3);
  const gallery = Array.isArray(config.galleryUrls) ? config.galleryUrls.filter(Boolean).slice(0, 5) : [];
  const hoursGroups = useMemo(() => groupWeeklyHours(config.weeklyHours), [config.weeklyHours]);
  const businessName = String(businessInfo?.name || slug || 'Barbearia').trim();
  const coverUrl = !coverFailed ? (config.coverUrl || businessInfo?.banner_url || '') : '';
  const canBook = featuredServices.length > 0 && professionals.length > 0;
  const facts = [
    businessInfo?.address ? { icon: <MapPin size={18} aria-hidden />, title: 'Endereço', lines: [businessInfo.address] } : null,
    hoursGroups.length ? {
      icon: <Clock3 size={18} aria-hidden />,
      title: 'Horários',
      lines: hoursGroups.map((group) => `${group.days} · ${group.hours}`),
    } : null,
  ].filter(Boolean);

  const showToast = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 1800);
  };

  const share = async () => {
    if (!interactive) return;
    const url = new URL(`/${slug}`, window.location.origin).href;
    const data = { title: businessName, text: config.heroTitle || 'Agende seu horário', url };
    if (navigator.share) {
      try {
        await navigator.share(data);
        showToast('Página compartilhada');
      } catch (error) {
        if (error?.name !== 'AbortError') showToast('Não foi possível compartilhar');
      }
      return;
    }
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard indisponível');
      await navigator.clipboard.writeText(url);
      showToast('Link copiado');
    } catch {
      showToast('Não foi possível copiar o link');
    }
  };

  const start = (selection = {}) => {
    if (interactive && canBook) onStartBooking(selection);
  };

  return (
    <div className="mbh" tabIndex={0} aria-label={`Conteúdo de ${businessName}`}>
      <header className="mbh__brand">
        <div>
          <h1>{businessName}</h1>
          {(businessInfo?.tagline || businessInfo?.slogan) ? <p>{businessInfo.tagline || businessInfo.slogan}</p> : null}
        </div>
        <div className="mbh__header-actions">
          <button type="button" onClick={onOpenAccount} aria-label={accountLabel} disabled={!interactive}>
            <CircleUserRound size={19} />
          </button>
          <button type="button" onClick={share} aria-label="Compartilhar" disabled={!interactive}>
            <Share2 size={19} />
          </button>
        </div>
      </header>

      <div className={`mbh__cover${coverUrl ? '' : ' mbh__cover--empty'}`}>
        {coverUrl ? (
          <img src={coverUrl} alt={`Ambiente de ${businessName}`} onError={() => setCoverFailed(true)} />
        ) : <Scissors size={44} aria-hidden />}
        {(coverUrl || gallery.length) ? (
          <span className="mbh__cover-count"><ImageIcon size={14} /> {gallery.length + (coverUrl ? 1 : 0)} foto(s)</span>
        ) : null}
      </div>

      <section className="mbh__intro">
        <h2>{config.heroTitle || 'Agende seu horário'}</h2>
        {config.heroText ? <p>{config.heroText}</p> : null}
      </section>

      <button type="button" className="mbh__book" onClick={() => start()} disabled={!interactive || !canBook}>
        <CalendarDays size={19} /> {canBook ? 'Agendar horário' : 'Agenda indisponível'}
      </button>

      {facts.length ? (
        <section className={`mbh__facts mbh__facts--${facts.length}`}>
          {facts.map(({ icon, title, lines }) => (
            <div key={title}>
              {icon}
              <strong>{title}</strong>
              {lines.map((line) => <span key={line}>{line}</span>)}
            </div>
          ))}
        </section>
      ) : null}

      <section className="mbh__section">
        <div className="mbh__section-title">
          <h3>Serviços em destaque</h3>
          {featuredServices.length ? <button type="button" onClick={() => start()} disabled={!interactive}>Ver todos</button> : null}
        </div>
        <div className="mbh__services">
          {featuredServices.length ? featuredServices.map((service) => {
            const serviceDuration = duration(service.duration);
            return (
              <button type="button" key={service.id} onClick={() => start({ service })} disabled={!interactive || !professionals.length}>
                <span><strong>{service.name}</strong>{serviceDuration ? <small>{serviceDuration}</small> : null}</span>
                <b>{money(service.price)}</b>
              </button>
            );
          }) : <div className="mbh__empty">Nenhum serviço disponível para reserva.</div>}
        </div>
      </section>

      <section className="mbh__section">
        <div className="mbh__section-title">
          <h3>Profissionais</h3>
          {professionals.length ? <button type="button" onClick={() => start()} disabled={!interactive}>Agendar</button> : null}
        </div>
        <div className="mbh__professionals">
          {professionals.length ? professionals.map((professional) => (
            <button type="button" key={professional.id} onClick={() => start({ professional })} disabled={!interactive || !featuredServices.length}>
              {professional.foto_perfil
                ? <img src={professional.foto_perfil} alt="" />
                : <span className="mbh__avatar">{initials(professional.name)}</span>}
              <strong>{professional.name}</strong>
              <small>{professional.role || 'Profissional'}</small>
            </button>
          )) : <div className="mbh__empty">Nenhum profissional disponível para reserva.</div>}
        </div>
      </section>

      {gallery.length ? (
        <section className="mbh__section">
          <div className="mbh__section-title"><h3>Galeria</h3></div>
          <div className="mbh__gallery">
            {gallery.map((url, index) => <img key={url} src={url} alt={`Foto ${index + 1} de ${businessName}`} />)}
          </div>
        </section>
      ) : null}

      {config.about ? (
        <section className="mbh__about">
          <h3>Sobre</h3>
          <p>{config.about}</p>
        </section>
      ) : null}

      {canBook ? (
        <button type="button" className="mbh__book mbh__book--bottom" onClick={() => start()} disabled={!interactive}>
          Agendar horário
        </button>
      ) : null}
      {toast ? <span className="mbh__toast" role="status">{toast}</span> : null}
    </div>
  );
}
