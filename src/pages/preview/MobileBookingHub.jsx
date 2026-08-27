import React, { useMemo, useState } from 'react';
import {
  CalendarDays,
  Clock3,
  Image as ImageIcon,
  MapPin,
  Scissors,
  Share2,
  Star,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useTenant } from '../../context/TenantContext';
import { filterBookableProfessionals } from '../../utils/bookableProfessionals';
import { readMobileHubConfig } from '../../utils/mobileHubConfig';
import './mobile-booking-hub.css';

function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function duration(value) {
  const text = String(value || '').trim();
  if (!text) return '30 min';
  return text.toLowerCase().includes('min') ? text : `${text} min`;
}

function initials(name) {
  return String(name || 'P').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

export default function MobileBookingHub({ onStartBooking }) {
  const { slug } = useTenant();
  const { businessInfo, services, barbers } = useApp();
  const [copied, setCopied] = useState(false);
  const config = readMobileHubConfig(slug);

  const professionals = useMemo(() => filterBookableProfessionals(barbers || []), [barbers]);
  const featuredServices = (services || []).slice(0, 3);
  const gallery = useMemo(() => {
    const custom = String(config.gallery || '').split(/\r?\n/).map((url) => url.trim()).filter(Boolean);
    const automatic = [
      config.coverUrl,
      businessInfo?.banner_url,
      businessInfo?.logo_url,
      ...professionals.map((professional) => professional.foto_perfil),
    ].filter(Boolean);
    return [...new Set([...custom, ...automatic])].slice(0, 5);
  }, [config.coverUrl, config.gallery, businessInfo, professionals]);

  const businessName = businessInfo?.name || slug;
  const coverUrl = config.coverUrl || businessInfo?.banner_url || gallery[0];

  const share = async () => {
    const data = { title: businessName, text: config.heroTitle, url: window.location.href };
    if (navigator.share) {
      await navigator.share(data).catch(() => {});
      return;
    }
    await navigator.clipboard?.writeText(data.url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="mbh" tabIndex={0} aria-label={`Conteúdo do hub de ${businessName}`}>
      <header className="mbh__brand">
        <div>
          <h1>{businessName}</h1>
          <p>{businessInfo?.tagline || 'Gestão. Agenda. Crescimento.'}</p>
        </div>
        <div className="mbh__header-actions">
          <button type="button" onClick={share} aria-label="Compartilhar"><Share2 size={19} /></button>
        </div>
      </header>

      <div className={`mbh__cover${coverUrl ? '' : ' mbh__cover--empty'}`}>
        {coverUrl ? <img src={coverUrl} alt={`Ambiente da ${businessName}`} /> : <Scissors size={44} aria-hidden />}
        <span className="mbh__cover-count"><ImageIcon size={14} /> {Math.max(gallery.length, 1)}/5</span>
      </div>

      <section className="mbh__intro">
        <h2>{config.heroTitle}</h2>
        <p>{config.heroText}</p>
      </section>

      <button type="button" className="mbh__book" onClick={onStartBooking}>
        <CalendarDays size={19} /> Agendar horário
      </button>

      <section className="mbh__facts">
        <div><Star size={18} /><strong>{config.rating}/5</strong><span>{config.reviews}</span></div>
        <div><MapPin size={18} /><strong>{config.city}</strong><span>{businessInfo?.address || 'Endereço não informado'}</span></div>
        <div><Clock3 size={18} /><strong>{config.hours.split(' · ')[0]}</strong><span>{config.hours.split(' · ')[1] || config.hours}</span></div>
      </section>

      <section className="mbh__section">
        <div className="mbh__section-title"><h3>Serviços em destaque</h3><button type="button" onClick={onStartBooking}>Ver todos</button></div>
        <div className="mbh__services">
          {featuredServices.length ? featuredServices.map((service) => (
            <button type="button" key={service.id} onClick={onStartBooking}>
              <span><strong>{service.name}</strong><small>{duration(service.duration)}</small></span>
              <b>{money(service.price)}</b>
            </button>
          )) : <div className="mbh__empty">Nenhum serviço cadastrado.</div>}
        </div>
      </section>

      <section className="mbh__section">
        <div className="mbh__section-title"><h3>Profissionais</h3><button type="button" onClick={onStartBooking}>Ver todos</button></div>
        <div className="mbh__professionals">
          {professionals.length ? professionals.map((professional) => (
            <button type="button" key={professional.id} onClick={onStartBooking}>
              {professional.foto_perfil
                ? <img src={professional.foto_perfil} alt="" />
                : <span className="mbh__avatar">{initials(professional.name)}</span>}
              <strong>{professional.name}</strong>
              <small>{professional.role === 'Gerente' ? 'Especialista' : 'Barbeiro'}</small>
            </button>
          )) : <div className="mbh__empty">Nenhum profissional disponível.</div>}
        </div>
      </section>

      <section className="mbh__section">
        <div className="mbh__section-title"><h3>Galeria</h3></div>
        <div className="mbh__gallery">
          {gallery.length ? gallery.map((url) => <img key={url} src={url} alt="Galeria da barbearia" />) : (
            <div className="mbh__gallery-empty"><ImageIcon size={22} /> Galeria em breve</div>
          )}
        </div>
      </section>

      <section className="mbh__about">
        <h3>Sobre a barbearia</h3>
        <p>{config.about}</p>
        {businessInfo?.slogan ? <em>{businessInfo.slogan}</em> : null}
      </section>

      <button type="button" className="mbh__book mbh__book--bottom" onClick={onStartBooking}>Agendar horário</button>
      {copied ? <span className="mbh__toast">Link copiado</span> : null}
    </div>
  );
}
