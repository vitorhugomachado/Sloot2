import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Image as ImageIcon,
  MapPin,
  Scissors,
  Share2,
  X,
} from 'lucide-react';
import ServiceBookingIcon from '../../components/booking/ServiceBookingIcon';
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

function brandParts(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { base: parts[0] || '', accent: '' };
  return { base: parts.slice(0, -1).join(' '), accent: parts.at(-1) };
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
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const closeLightboxRef = useRef(null);
  const swipeStartXRef = useRef(null);
  const config = configProp || businessInfo?.bookingPage || {};

  const professionals = useMemo(() => filterBookableProfessionals(barbers || []), [barbers]);
  const featuredServices = (services || []).slice(0, 3);
  const gallery = useMemo(
    () => (Array.isArray(config.galleryUrls) ? config.galleryUrls.filter(Boolean).slice(0, 5) : []),
    [config.galleryUrls],
  );
  const hoursGroups = useMemo(() => groupWeeklyHours(config.weeklyHours), [config.weeklyHours]);
  const businessName = String(businessInfo?.name || slug || 'Barbearia').trim();
  const brand = useMemo(() => brandParts(businessName), [businessName]);
  const coverUrl = !coverFailed ? (config.coverUrl || businessInfo?.banner_url || '') : '';
  const mediaItems = useMemo(() => [...new Set([coverUrl, ...gallery].filter(Boolean))], [coverUrl, gallery]);
  const canBook = featuredServices.length > 0 && professionals.length > 0;
  const tagline = String(businessInfo?.tagline || businessInfo?.slogan || '').trim();
  const facts = [
    businessInfo?.address ? { icon: <MapPin size={20} aria-hidden />, title: 'Endereço', lines: [businessInfo.address] } : null,
    hoursGroups.length ? {
      icon: <Clock3 size={20} aria-hidden />,
      title: 'Expediente',
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

  const openGallery = (index = 0) => {
    if (interactive && mediaItems.length) setLightboxIndex(index);
  };

  const closeGallery = () => setLightboxIndex(null);
  const showPrevious = () => setLightboxIndex((index) => (index - 1 + mediaItems.length) % mediaItems.length);
  const showNext = () => setLightboxIndex((index) => (index + 1) % mediaItems.length);

  useEffect(() => {
    if (lightboxIndex == null) return undefined;
    closeLightboxRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setLightboxIndex(null);
      if (event.key === 'ArrowLeft' && mediaItems.length > 1) {
        setLightboxIndex((index) => (index - 1 + mediaItems.length) % mediaItems.length);
      }
      if (event.key === 'ArrowRight' && mediaItems.length > 1) {
        setLightboxIndex((index) => (index + 1) % mediaItems.length);
      }
      if (event.key === 'Tab') {
        const dialog = closeLightboxRef.current?.closest('[role="dialog"]');
        const focusable = Array.from(dialog?.querySelectorAll('button:not(:disabled)') || []);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxIndex, mediaItems.length]);

  return (
    <div className={`mbh${interactive ? '' : ' mbh--static'}`} tabIndex={0} aria-label={`Conteúdo de ${businessName}`}>
      <div
        className={`mbh__ambient${coverUrl ? ' mbh__ambient--image' : ''}`}
        style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined}
        aria-hidden="true"
      />
      <div className="mbh__content">
        <header className="mbh__brand">
          <span className="mbh__brand-spacer" aria-hidden="true" />
          <div className={`mbh__brand-mark${businessName.length > 18 ? ' mbh__brand-mark--long' : ''}`}>
            {businessInfo?.logo_url ? (
              <img src={businessInfo.logo_url} alt={businessName} className="mbh__brand-logo" />
            ) : (
              <h1 title={businessName}><span>{brand.base}</span>{brand.accent ? <> <em>{brand.accent}</em></> : null}</h1>
            )}
            {tagline ? <p>{tagline}</p> : null}
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

        <button
          type="button"
          className={`mbh__cover${coverUrl ? '' : ' mbh__cover--empty'}`}
          onClick={() => openGallery(0)}
          disabled={!interactive || !mediaItems.length}
          aria-label={mediaItems.length ? `Abrir galeria, foto 1 de ${mediaItems.length}` : 'Foto de capa não informada'}
        >
          {coverUrl ? (
            <img src={coverUrl} alt={`Ambiente de ${businessName}`} onError={() => setCoverFailed(true)} />
          ) : <Scissors size={48} aria-hidden />}
          {mediaItems.length ? (
            <span className="mbh__cover-count"><ImageIcon size={15} /> 1/{mediaItems.length}</span>
          ) : null}
        </button>

        <section className="mbh__intro">
          <h2>{config.heroTitle || 'Agende seu horário'}</h2>
          {config.heroText ? <p>{config.heroText}</p> : null}
        </section>

        <button type="button" className="mbh__book" onClick={() => start()} disabled={!interactive || !canBook}>
          {canBook ? 'Agendar horário' : 'Agenda indisponível'}
        </button>

        {facts.length ? (
          <section className={`mbh__facts mbh__facts--${facts.length}`} aria-label="Informações do estabelecimento">
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
                  <ServiceBookingIcon icon={service.bookingIcon} className="mbh__service-icon" />
                  <span className="mbh__service-copy">
                    <strong>{service.name}</strong>
                    {serviceDuration ? <small><Clock3 size={13} aria-hidden /> {serviceDuration}</small> : null}
                  </span>
                  <b>{money(service.price)}</b>
                </button>
              );
            }) : <div className="mbh__empty">Nenhum serviço disponível para reserva.</div>}
          </div>
        </section>

        <section className="mbh__section">
          <div className="mbh__section-title">
            <h3>Profissionais</h3>
            {professionals.length ? <button type="button" onClick={() => start()} disabled={!interactive}>Ver todos</button> : null}
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
            <div className="mbh__section-title">
              <h3>Galeria</h3>
              <button type="button" onClick={() => openGallery(coverUrl ? 1 : 0)} disabled={!interactive}>Ver todas</button>
            </div>
            <div className="mbh__gallery">
              {gallery.map((url, index) => {
                const mediaIndex = mediaItems.indexOf(url);
                return (
                  <button type="button" key={url} onClick={() => openGallery(mediaIndex)} disabled={!interactive} aria-label={`Abrir foto ${index + 1} da galeria`}>
                    <img src={url} alt={`Foto ${index + 1} de ${businessName}`} />
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {config.about ? (
          <section className="mbh__about">
            <h3>Sobre a barbearia</h3>
            <p>{config.about}</p>
          </section>
        ) : null}

        {canBook ? (
          <button type="button" className="mbh__book mbh__book--bottom" onClick={() => start()} disabled={!interactive}>
            Agendar horário
          </button>
        ) : null}
      </div>

      {lightboxIndex != null ? (
        <div
          className="mbh__lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Galeria de fotos"
          onTouchStart={(event) => { swipeStartXRef.current = event.touches[0]?.clientX ?? null; }}
          onTouchEnd={(event) => {
            const endX = event.changedTouches[0]?.clientX;
            if (swipeStartXRef.current == null || endX == null || mediaItems.length < 2) return;
            const delta = endX - swipeStartXRef.current;
            if (delta > 45) showPrevious();
            if (delta < -45) showNext();
            swipeStartXRef.current = null;
          }}
        >
          <button ref={closeLightboxRef} type="button" className="mbh__lightbox-close" onClick={closeGallery} aria-label="Fechar galeria"><X size={24} /></button>
          <img src={mediaItems[lightboxIndex]} alt={`Foto ${lightboxIndex + 1} de ${businessName}`} />
          <span className="mbh__lightbox-count">{lightboxIndex + 1}/{mediaItems.length}</span>
          {mediaItems.length > 1 ? (
            <>
              <button type="button" className="mbh__lightbox-nav mbh__lightbox-nav--previous" onClick={showPrevious} aria-label="Foto anterior"><ChevronLeft size={26} /></button>
              <button type="button" className="mbh__lightbox-nav mbh__lightbox-nav--next" onClick={showNext} aria-label="Próxima foto"><ChevronRight size={26} /></button>
            </>
          ) : null}
        </div>
      ) : null}
      {toast ? <span className="mbh__toast" role="status">{toast}</span> : null}
    </div>
  );
}
