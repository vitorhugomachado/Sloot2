import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  Calendar,
  Check,
  Clock,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
} from 'lucide-react';
import SlootiLogo from '../../components/SlootiLogo';
import { LANDING_WHATSAPP_URL } from '../landing-teste/landingContact.config';
import {
  BENTO_CARDS,
  BILLING_OPTIONS,
  DEFAULT_BILLING,
  formatPlanPrice,
  FRUSTRATIONS,
  HERO_FLOATING_CARDS,
  HERO_ROTATING_WORDS,
  HERO_UNLIMITED,
  PHONE_APPOINTMENTS,
  PLAN_PRICING,
  PRICING_CHECKLIST,
  PRICING_NEGATIVES,
  REVEAL_BADGES,
} from './landing2.config';
import {
  useCountUp,
  useFloating,
  useHeaderState,
  useHeroIntro,
  useMouseGlow,
  useRevealConverge,
  useScrollReveal,
  useScrollStory,
  useTiltCards,
} from './useLanding2Effects';
import './landing2.css';

const CARD_ICONS = {
  calendar: Calendar,
  wallet: Wallet,
  bell: Bell,
  users: Users,
  clock: Clock,
};

const STORY_WORD = 'ILIMITADO';

function HeroFloatingCard({ card, index }) {
  const Icon = CARD_ICONS[card.icon] || Calendar;
  return (
    <div
      className={`lp2-float-card lp2-float-card--${index + 1}${card.accent ? ' is-accent' : ''}`}
      data-hero-card
      data-float
    >
      <span className="lp2-float-card__icon">
        <Icon size={15} strokeWidth={2.2} />
      </span>
      <span className="lp2-float-card__body">
        <span className="lp2-float-card__label">{card.label}</span>
        <span className="lp2-float-card__value">{card.value}</span>
      </span>
    </div>
  );
}

function HeroPhone() {
  return (
    <div className="lp2-phone" data-hero-phone data-float>
      <div className="lp2-phone__glow" aria-hidden />
      <div className="lp2-phone__device">
        <div className="lp2-phone__notch" aria-hidden />
        <div className="lp2-phone__screen">
          <div className="lp2-phone__header">
            <span className="lp2-phone__title">Agenda de hoje</span>
            <span className="lp2-phone__date">Seg, 13 Jul</span>
          </div>
          <div className="lp2-phone__list">
            {PHONE_APPOINTMENTS.map((apt) => (
              <div key={apt.time} className={`lp2-phone__apt is-${apt.status}`}>
                <span className="lp2-phone__apt-time">{apt.time}</span>
                <span className="lp2-phone__apt-info">
                  <span className="lp2-phone__apt-client">{apt.client}</span>
                  <span className="lp2-phone__apt-service">{apt.service}</span>
                </span>
                <span className="lp2-phone__apt-dot" aria-hidden />
              </div>
            ))}
          </div>
          <div className="lp2-phone__footer">
            <span className="lp2-phone__footer-pill">6 confirmados</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function BentoVisual({ id }) {
  if (id === 'agenda') {
    return (
      <div className="lp2-bento__visual lp2-bento__visual--agenda" aria-hidden>
        {['09:00', '10:30', '13:00', '15:30', '17:00'].map((t, i) => (
          <div key={t} className="lp2-bento__slot" style={{ '--i': i }}>
            <span>{t}</span>
            <span className="lp2-bento__slot-bar" />
          </div>
        ))}
      </div>
    );
  }
  if (id === 'revenue') {
    return (
      <div className="lp2-bento__visual lp2-bento__visual--chart" aria-hidden>
        {[42, 58, 40, 72, 64, 88, 96].map((h, i) => (
          <span key={i} className="lp2-bento__bar" style={{ '--h': `${h}%`, '--i': i }} />
        ))}
      </div>
    );
  }
  if (id === 'notifications') {
    return (
      <div className="lp2-bento__visual lp2-bento__visual--notif" aria-hidden>
        <div className="lp2-bento__notif">
          <Bell size={13} strokeWidth={2.4} />
          <span>Novo agendamento · 15:30</span>
        </div>
      </div>
    );
  }
  if (id === 'ranking') {
    return (
      <div className="lp2-bento__visual lp2-bento__visual--rank" aria-hidden>
        {[{ n: 'Carlos', w: 92 }, { n: 'Rafa', w: 74 }, { n: 'Léo', w: 58 }].map((r, i) => (
          <div key={r.n} className="lp2-bento__rank-row" style={{ '--i': i }}>
            <span className="lp2-bento__rank-name">{r.n}</span>
            <span className="lp2-bento__rank-track">
              <span className="lp2-bento__rank-fill" style={{ '--w': `${r.w}%` }} />
            </span>
          </div>
        ))}
      </div>
    );
  }
  if (id === 'clock') {
    return (
      <div className="lp2-bento__visual lp2-bento__visual--clock" aria-hidden>
        <div className="lp2-clockface">
          <span className="lp2-clockface__hand lp2-clockface__hand--h" />
          <span className="lp2-clockface__hand lp2-clockface__hand--m" />
          <span className="lp2-clockface__center" />
        </div>
      </div>
    );
  }
  return (
    <div className="lp2-bento__visual lp2-bento__visual--clients" aria-hidden>
      <div className="lp2-bento__avatars">
        {['R', 'B', 'D', 'L'].map((c, i) => (
          <span key={c} className="lp2-bento__avatar" style={{ '--i': i }}>{c}</span>
        ))}
        <span className="lp2-bento__avatar lp2-bento__avatar--more">+∞</span>
      </div>
    </div>
  );
}

function BentoStat() {
  const [ref, value] = useCountUp(1240, { duration: 1.8 });
  return (
    <span ref={ref} className="lp2-bento__stat">
      R$ {value.toLocaleString('pt-BR')}
    </span>
  );
}

export default function Landing2Page() {
  const pageRef = useRef(null);
  const heroRef = useRef(null);
  const storyRef = useRef(null);
  const revealRef = useRef(null);
  const bentoRef = useRef(null);

  const scrolled = useHeaderState();
  const [wordIndex, setWordIndex] = useState(0);
  const [billing, setBilling] = useState(DEFAULT_BILLING);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const id = window.setInterval(() => {
      setWordIndex((i) => (i + 1) % HERO_ROTATING_WORDS.length);
    }, 3500);
    return () => window.clearInterval(id);
  }, []);

  useHeroIntro(heroRef);
  useFloating(heroRef);
  useScrollStory(storyRef);
  useRevealConverge(revealRef);
  useScrollReveal(pageRef);
  useMouseGlow(pageRef);
  useTiltCards(bentoRef);

  useEffect(() => {
    document.title = 'Slooti — Tudo ilimitado por R$89,90/mês';
  }, []);

  const goToPricing = () => {
    document.getElementById('lp2-pricing')?.scrollIntoView({ behavior: 'smooth' });
  };

  const isAnnual = billing === 'annual';
  const ctaPriceLabel = isAnnual
    ? `12x de ${formatPlanPrice(PLAN_PRICING.annualInstallmentValue)}`
    : `${formatPlanPrice(PLAN_PRICING.monthly)}/mês`;

  return (
    <div ref={pageRef} className="lp2">
      <div className="lp2__spotlight" aria-hidden />

      <header className={`lp2-header${scrolled ? ' is-scrolled' : ''}`}>
        <div className="lp2-header__inner">
          <a className="lp2-header__brand" href="/paginadevendas" aria-label="Slooti">
            <SlootiLogo className="lp2-header__logo" onDark={false} />
          </a>
          <nav className="lp2-header__nav" aria-label="Navegação">
            <button type="button" className="lp2-header__link" onClick={goToPricing}>
              Preço
            </button>
            <a
              className="lp2-btn lp2-btn--primary lp2-btn--sm"
              href={LANDING_WHATSAPP_URL}
              target="_blank"
              rel="noreferrer"
            >
              Começar agora
            </a>
          </nav>
        </div>
      </header>

      {/* ============ HERO ============ */}
      <section ref={heroRef} className="lp2-hero">
        <div className="lp2-hero__bg" aria-hidden />
        <div className="lp2-hero__inner">
          <div className="lp2-hero__copy">
            <h1 className="lp2-hero__headline" data-hero-fade>
              Agendamentos inteligentes para barbearias{' '}
              <span className="lp2-hero__rotator" aria-live="polite">
                {HERO_ROTATING_WORDS.map((word, i) => (
                  <span
                    key={word}
                    className={`lp2-hero__rotator-word${i === wordIndex ? ' is-active' : ''}`}
                    aria-hidden={i !== wordIndex}
                  >
                    {word}
                  </span>
                ))}
              </span>
            </h1>

            <div className="lp2-hero__price" data-hero-price>
              <span className="lp2-hero__price-currency">R$</span>
              <span className="lp2-hero__price-value">89</span>
              <span className="lp2-hero__price-cents">,90</span>
              <span className="lp2-hero__price-period">/mês</span>
            </div>

            <p className="lp2-hero__tagline" data-hero-fade>
              Tudo ilimitado.
            </p>

            <ul className="lp2-hero__unlimited" data-hero-fade>
              {HERO_UNLIMITED.map((item) => (
                <li key={item}>
                  <Check size={14} strokeWidth={3} aria-hidden />
                  {item}
                </li>
              ))}
            </ul>

            <div className="lp2-hero__ctas" data-hero-fade>
              <a
                className="lp2-btn lp2-btn--primary"
                href={LANDING_WHATSAPP_URL}
                target="_blank"
                rel="noreferrer"
              >
                Começar Agora
              </a>
              <button type="button" className="lp2-btn lp2-btn--ghost" onClick={goToPricing}>
                Ver demonstração
              </button>
            </div>

            <p className="lp2-hero__fineprint" data-hero-fade>
              Sem upgrades. Sem taxas ocultas. Sem restrições de funcionalidades.
            </p>
          </div>

          <div className="lp2-hero__visual">
            <HeroPhone />
            {HERO_FLOATING_CARDS.map((card, i) => (
              <HeroFloatingCard key={card.id} card={card} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ============ SCROLL STORY ============ */}
      <section ref={storyRef} className="lp2-story" aria-label="Comparação com concorrentes">
        <div className="lp2-story__stage" data-story-stage>
          <div className="lp2-story__word" aria-hidden>
            {STORY_WORD.split('').map((letter, i) => (
              <span key={`${letter}-${i}`} className="lp2-story__letter" data-story-letter>
                {letter}
              </span>
            ))}
          </div>

          <div className="lp2-story__chaos" aria-hidden>
            {FRUSTRATIONS.map((label, i) => (
              <span
                key={label}
                className={`lp2-story__chip lp2-story__chip--${(i % 6) + 1}`}
                data-story-chip
                style={{
                  '--cx': `${8 + ((i * 37) % 84)}%`,
                  '--cy': `${12 + ((i * 53) % 72)}%`,
                  '--cr': `${((i * 17) % 13) - 6}deg`,
                }}
              >
                {label}
              </span>
            ))}
          </div>

          <div className="lp2-story__calm" data-story-calm>
            <p>A Slooti faz diferente.</p>
          </div>
        </div>
      </section>

      {/* ============ BIG REVEAL ============ */}
      <section ref={revealRef} className="lp2-reveal" id="lp2-pricing">
        <div className="lp2-reveal__inner">
          <div className="lp2-reveal__head" data-reveal-title>
            <h2 className="lp2-reveal__title">
              Um preço. <span className="lp2-reveal__title-accent">Tudo incluso.</span>
            </h2>
            <p className="lp2-reveal__subtitle">
              Mensal ou anual — um único plano com tudo incluso.
            </p>
          </div>

          <div className="lp2-reveal__badges" aria-hidden>
            {REVEAL_BADGES.map((badge) => (
              <span key={badge} className="lp2-reveal__badge" data-reveal-badge>
                {badge}
              </span>
            ))}
          </div>

          {/* ============ PRICING CARD ============ */}
          <div className="lp2-pricing-card" data-reveal-card>
            <div className="lp2-pricing-card__glow" aria-hidden />
            <span className="lp2-pricing-card__badge">TUDO INCLUSO</span>
            <h3 className="lp2-pricing-card__title">Plano Completo</h3>

            <div className="lp2-pricing-card__billing" role="tablist" aria-label="Período de cobrança">
              {BILLING_OPTIONS.map((option) => {
                const isActive = billing === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`lp2-pricing-card__billing-option${isActive ? ' is-active' : ''}`}
                    onClick={() => setBilling(option.id)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            {isAnnual ? (
              <div className="lp2-pricing-card__price lp2-pricing-card__price--annual">
                <span className="lp2-pricing-card__price-installments">
                  {PLAN_PRICING.annualInstallments}x de
                </span>
                <span className="lp2-pricing-card__price-currency">R$</span>
                <span className="lp2-pricing-card__price-value">
                  {PLAN_PRICING.annualInstallmentValue.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <p className="lp2-pricing-card__price-note">
                  ou {formatPlanPrice(PLAN_PRICING.annualCash, 0)} à vista no ano
                </p>
              </div>
            ) : (
              <div className="lp2-pricing-card__price">
                <span className="lp2-pricing-card__price-currency">R$</span>
                <span className="lp2-pricing-card__price-value">
                  {PLAN_PRICING.monthly.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span className="lp2-pricing-card__price-period">/mês</span>
              </div>
            )}

            <ul className="lp2-pricing-card__negatives" data-reveal-stagger>
              {PRICING_NEGATIVES.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>

            <p className="lp2-pricing-card__forever">Tudo incluso. Para sempre.</p>

            <ul className="lp2-pricing-card__checklist" data-reveal-stagger>
              {PRICING_CHECKLIST.map((item) => (
                <li key={item}>
                  <span className="lp2-pricing-card__check" aria-hidden>
                    <Check size={13} strokeWidth={3.2} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>

            <a
              className="lp2-btn lp2-btn--primary lp2-btn--xl"
              href={LANDING_WHATSAPP_URL}
              target="_blank"
              rel="noreferrer"
            >
              Começar Agora
            </a>
            <p className="lp2-pricing-card__note">Sem fidelidade. Cancele quando quiser.</p>
          </div>
        </div>
      </section>

      {/* ============ BENTO FEATURES ============ */}
      <section ref={bentoRef} className="lp2-bento">
        <div className="lp2-bento__inner">
          <div className="lp2-bento__head" data-reveal>
            <h2 className="lp2-bento__title">
              Tudo que sua barbearia precisa. <span>Vivo, na tela.</span>
            </h2>
          </div>

          <div className="lp2-bento__grid" data-reveal-stagger>
            {BENTO_CARDS.map((card) => (
              <article
                key={card.id}
                className={`lp2-bento__card lp2-bento__card--${card.size}`}
                data-tilt
              >
                <div className="lp2-bento__card-glow" aria-hidden />
                <BentoVisual id={card.id} />
                {card.id === 'revenue' && <BentoStat />}
                <h3 className="lp2-bento__card-title">
                  {card.id === 'agenda' && <Calendar size={16} strokeWidth={2.4} aria-hidden />}
                  {card.id === 'revenue' && <TrendingUp size={16} strokeWidth={2.4} aria-hidden />}
                  {card.id === 'notifications' && <Bell size={16} strokeWidth={2.4} aria-hidden />}
                  {card.id === 'ranking' && <Trophy size={16} strokeWidth={2.4} aria-hidden />}
                  {card.id === 'clock' && <Clock size={16} strokeWidth={2.4} aria-hidden />}
                  {card.id === 'clients' && <Users size={16} strokeWidth={2.4} aria-hidden />}
                  {card.title}
                </h3>
                <p className="lp2-bento__card-text">{card.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FINAL CTA ============ */}
      <section className="lp2-final">
        <div className="lp2-final__glow" aria-hidden />
        <div className="lp2-final__particles" aria-hidden>
          {Array.from({ length: 14 }).map((_, i) => (
            <span key={i} className="lp2-final__particle" style={{ '--i': i }} />
          ))}
        </div>
        <div className="lp2-final__inner" data-reveal>
          <h2 className="lp2-final__title">
            Pare de pagar pelo <span>crescimento</span> da sua barbearia.
          </h2>
          <p className="lp2-final__text">
            Na Slooti você paga apenas um valor fixo. Para sempre. Tudo incluso.
          </p>
          <a
            className="lp2-btn lp2-btn--primary lp2-btn--xl"
            href={LANDING_WHATSAPP_URL}
            target="_blank"
            rel="noreferrer"
          >
            Começar Agora — {ctaPriceLabel}
          </a>
        </div>
      </section>

      <footer className="lp2-footer">
        <div className="lp2-footer__inner">
          <a href="/paginadevendas" className="lp2-footer__brand" aria-label="Slooti">
            <SlootiLogo className="lp2-footer__logo" onDark={false} />
          </a>
          <p>Tudo ilimitado. R$89,90. Slooti.</p>
          <span className="lp2-footer__copy">© {new Date().getFullYear()} Slooti</span>
        </div>
      </footer>
    </div>
  );
}
