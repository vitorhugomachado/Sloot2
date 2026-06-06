import { useEffect, useRef, useState } from 'react';
import { Calendar, Check, ChevronLeft, ChevronRight, Clock, Link2, Menu, Scissors, Sparkles, User, X } from 'lucide-react';
import SlootiLogo from '../../components/SlootiLogo';
import { LANDING_WHATSAPP_URL } from './landingContact.config';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import PhoneMockup from './PhoneMockup';
import TiltCard from './TiltCard';
import STEP_ILLUSTRATIONS from './LandingStepIcons';
import {
  BENEFITS,
  BILLING_OPTIONS,
  DEFAULT_BILLING,
  FAQ_ITEMS,
  getPlanPriceDisplay,
  HERO_ROTATING_WORDS,
  METRICS,
  MOBILE_PLANS,
  NAV_LINKS,
  PAIN_SECTION,
  PLANS,
  SCROLL_PHRASES,
  STEPS,
} from './landingTeste.config';
import {
  useAnimatedCounters,
  useBackgroundOrbs,
  useCursorGlow,
  useHeaderBlur,
  useHeroEntrance,
  useScrollPhrases,
  useScrollReveal,
} from './useLandingTesteEffects';
import './landing-teste.css';

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function scrollToSection(id, onDone) {
  scrollToId(id);
  onDone?.();
}

const BENEFITS_CAROUSEL_MS = 4500;

function SectionDivider({ dark = false }) {
  return (
    <hr
      className={`lt-section-divider${dark ? ' lt-section-divider--on-dark' : ''}`}
      aria-hidden
    />
  );
}

const BENEFIT_ICONS = {
  calendar: Calendar,
  link: Link2,
  scissors: Scissors,
  user: User,
  sparkles: Sparkles,
  clock: Clock,
};

function getCircularOffset(index, activeIndex, total) {
  let offset = index - activeIndex;
  if (offset > total / 2) offset -= total;
  if (offset < -total / 2) offset += total;
  return offset;
}

function getBenefitCardStyle(index, activeIndex) {
  const offset = getCircularOffset(index, activeIndex, BENEFITS.length);
  const abs = Math.abs(offset);

  return {
    '--lt-benefit-x': `${offset * 58}%`,
    '--lt-benefit-z': `${-abs * 72}px`,
    '--lt-benefit-rotate': `${offset * -38}deg`,
    '--lt-benefit-scale': offset === 0 ? 1 : abs === 1 ? 0.9 : 0.78,
    '--lt-benefit-opacity': abs > 2 ? 0 : offset === 0 ? 1 : abs === 1 ? 0.82 : 0.5,
    zIndex: 20 - abs,
    pointerEvents: abs <= 1 ? 'auto' : 'none',
  };
}

export default function LandingTestePage() {
  const pageRef = useRef(null);
  const heroRef = useRef(null);
  const scrollSectionRef = useRef(null);
  const metricsRef = useRef(null);
  const phraseRefs = useRef([]);
  const [wordIndex, setWordIndex] = useState(0);
  const [openFaq, setOpenFaq] = useState(-1);
  const [billing, setBilling] = useState(DEFAULT_BILLING);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isMobileLanding = useMediaQuery('(max-width: 960px)');
  const [activeBenefit, setActiveBenefit] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const [activePlan, setActivePlan] = useState(1);
  const benefitsTouchStartX = useRef(null);
  const benefitsTouchStartY = useRef(null);
  const [benefitsTouchRoot, setBenefitsTouchRoot] = useState(null);
  const pricingViewportRef = useRef(null);
  const pricingTouchStartX = useRef(null);
  const pricingTouchStartY = useRef(null);
  const stepsViewportRef = useRef(null);
  const stepsTouchStartX = useRef(null);
  const stepsTouchStartY = useRef(null);

  const scrolled = useHeaderBlur();
  const glowRef = useCursorGlow(pageRef);

  useHeroEntrance(heroRef);
  useScrollReveal(pageRef);
  useScrollPhrases(scrollSectionRef, phraseRefs, isMobileLanding);
  useAnimatedCounters(metricsRef);
  useBackgroundOrbs(pageRef);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return undefined;

    const id = window.setInterval(() => {
      setWordIndex((i) => (i + 1) % HERO_ROTATING_WORDS.length);
    }, 2600);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 861px)');
    const closeNav = () => {
      if (mq.matches) setMobileNavOpen(false);
    };
    mq.addEventListener('change', closeNav);
    return () => mq.removeEventListener('change', closeNav);
  }, []);

  useEffect(() => {
    setActivePlan(isMobileLanding ? 1 : 0);
    if (!isMobileLanding) setActiveStep(0);
  }, [isMobileLanding]);

  useEffect(() => {
    if (!isMobileLanding) return undefined;

    const viewport = stepsViewportRef.current;
    if (!viewport) return undefined;

    const onTouchStart = (event) => {
      const touch = event.touches[0];
      if (!touch) return;
      stepsTouchStartX.current = touch.clientX;
      stepsTouchStartY.current = touch.clientY;
    };

    const onTouchMove = (event) => {
      if (stepsTouchStartX.current == null || stepsTouchStartY.current == null) return;

      const touch = event.touches[0];
      if (!touch) return;

      const deltaX = touch.clientX - stepsTouchStartX.current;
      const deltaY = touch.clientY - stepsTouchStartY.current;

      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
        event.preventDefault();
      }
    };

    const onTouchEnd = (event) => {
      if (stepsTouchStartX.current == null || stepsTouchStartY.current == null) return;

      const touch = event.changedTouches[0];
      if (!touch) return;

      const deltaX = touch.clientX - stepsTouchStartX.current;
      const deltaY = touch.clientY - stepsTouchStartY.current;

      stepsTouchStartX.current = null;
      stepsTouchStartY.current = null;

      if (Math.abs(deltaX) < 32 || Math.abs(deltaX) < Math.abs(deltaY)) return;

      if (deltaX < 0) {
        setActiveStep((current) => Math.min(current + 1, STEPS.length - 1));
      } else {
        setActiveStep((current) => Math.max(current - 1, 0));
      }
    };

    viewport.addEventListener('touchstart', onTouchStart, { passive: true });
    viewport.addEventListener('touchmove', onTouchMove, { passive: false });
    viewport.addEventListener('touchend', onTouchEnd, { passive: true });
    viewport.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      viewport.removeEventListener('touchstart', onTouchStart);
      viewport.removeEventListener('touchmove', onTouchMove);
      viewport.removeEventListener('touchend', onTouchEnd);
      viewport.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [isMobileLanding]);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return undefined;

    const id = window.setInterval(() => {
      setActiveBenefit((current) => (current + 1) % BENEFITS.length);
    }, BENEFITS_CAROUSEL_MS);

    return () => window.clearInterval(id);
  }, []);

  const goToBenefit = (index) => {
    setActiveBenefit((index + BENEFITS.length) % BENEFITS.length);
  };

  const nextBenefit = () => {
    setActiveBenefit((current) => (current + 1) % BENEFITS.length);
  };

  const prevBenefit = () => {
    setActiveBenefit((current) => (current - 1 + BENEFITS.length) % BENEFITS.length);
  };

  const bindBenefitsCarouselRef = (node) => {
    setBenefitsTouchRoot(node);
  };

  const goToPlan = (index) => {
    setActivePlan(Math.min(Math.max(index, 0), MOBILE_PLANS.length - 1));
  };

  useEffect(() => {
    const viewport = benefitsTouchRoot;
    if (!viewport) return undefined;

    const onTouchStart = (event) => {
      const touch = event.touches[0];
      if (!touch) return;
      benefitsTouchStartX.current = touch.clientX;
      benefitsTouchStartY.current = touch.clientY;
    };

    const onTouchMove = (event) => {
      if (benefitsTouchStartX.current == null || benefitsTouchStartY.current == null) return;

      const touch = event.touches[0];
      if (!touch) return;

      const deltaX = touch.clientX - benefitsTouchStartX.current;
      const deltaY = touch.clientY - benefitsTouchStartY.current;

      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 8) {
        event.preventDefault();
      }
    };

    const onTouchEnd = (event) => {
      if (benefitsTouchStartX.current == null || benefitsTouchStartY.current == null) return;

      const touch = event.changedTouches[0];
      if (!touch) return;

      const deltaX = touch.clientX - benefitsTouchStartX.current;
      const deltaY = touch.clientY - benefitsTouchStartY.current;

      benefitsTouchStartX.current = null;
      benefitsTouchStartY.current = null;

      if (Math.abs(deltaX) < 32 || Math.abs(deltaX) < Math.abs(deltaY)) return;

      if (deltaX < 0) {
        setActiveBenefit((current) => (current + 1) % BENEFITS.length);
      } else {
        setActiveBenefit((current) => (current - 1 + BENEFITS.length) % BENEFITS.length);
      }
    };

    viewport.addEventListener('touchstart', onTouchStart, { passive: true });
    viewport.addEventListener('touchmove', onTouchMove, { passive: false });
    viewport.addEventListener('touchend', onTouchEnd, { passive: true });
    viewport.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      viewport.removeEventListener('touchstart', onTouchStart);
      viewport.removeEventListener('touchmove', onTouchMove);
      viewport.removeEventListener('touchend', onTouchEnd);
      viewport.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [benefitsTouchRoot]);

  useEffect(() => {
    if (!isMobileLanding) return undefined;

    const viewport = pricingViewportRef.current;
    if (!viewport) return undefined;

    const onTouchStart = (event) => {
      const touch = event.touches[0];
      if (!touch) return;
      pricingTouchStartX.current = touch.clientX;
      pricingTouchStartY.current = touch.clientY;
    };

    const onTouchMove = (event) => {
      if (pricingTouchStartX.current == null || pricingTouchStartY.current == null) return;

      const touch = event.touches[0];
      if (!touch) return;

      const deltaX = touch.clientX - pricingTouchStartX.current;
      const deltaY = touch.clientY - pricingTouchStartY.current;

      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
        event.preventDefault();
      }
    };

    const onTouchEnd = (event) => {
      if (pricingTouchStartX.current == null || pricingTouchStartY.current == null) return;

      const touch = event.changedTouches[0];
      if (!touch) return;

      const deltaX = touch.clientX - pricingTouchStartX.current;
      const deltaY = touch.clientY - pricingTouchStartY.current;

      pricingTouchStartX.current = null;
      pricingTouchStartY.current = null;

      if (Math.abs(deltaX) < 36 || Math.abs(deltaX) < Math.abs(deltaY)) return;

      if (deltaX < 0) {
        setActivePlan((current) => Math.min(current + 1, MOBILE_PLANS.length - 1));
      } else {
        setActivePlan((current) => Math.max(current - 1, 0));
      }
    };

    viewport.addEventListener('touchstart', onTouchStart, { passive: true });
    viewport.addEventListener('touchmove', onTouchMove, { passive: false });
    viewport.addEventListener('touchend', onTouchEnd, { passive: true });
    viewport.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      viewport.removeEventListener('touchstart', onTouchStart);
      viewport.removeEventListener('touchmove', onTouchMove);
      viewport.removeEventListener('touchend', onTouchEnd);
      viewport.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [isMobileLanding]);

  const renderPlanCard = (plan, { reveal = false, static: isStatic = false } = {}) => {
    const price = getPlanPriceDisplay(plan, billing);
    const className = `lt-plan-card${plan.featured ? ' is-featured' : ''}`;

    const cardBody = (
      <>
        {plan.badge ? <span className="lt-plan-card__badge">{plan.badge}</span> : null}
        <h3 className="lt-plan-card__name">{plan.name}</h3>
        {price.type === 'consult' ? (
          <p className="lt-plan-card__price lt-plan-card__price--consult">Sob consulta</p>
        ) : (
          <div className="lt-plan-card__price-block">
            <p className={`lt-plan-card__price${price.period ? '' : ' lt-plan-card__price--headline'}`}>
              {price.headline}
              {price.period ? <span>{price.period}</span> : null}
            </p>
            {price.pill ? (
              <span className={`lt-plan-card__pill${plan.featured ? ' is-featured' : ''}`}>{price.pill}</span>
            ) : null}
            {price.note ? <span className="lt-plan-card__price-note">{price.note}</span> : null}
          </div>
        )}
        <p className="lt-plan-card__desc">{plan.description}</p>
        {plan.includes ? (
          <div className="lt-plan-card__feature-groups">
            <div className="lt-plan-card__feature-group">
              <p
                className={`lt-plan-card__feature-label${
                  plan.includesLabelStyle === 'normal' ? ' lt-plan-card__feature-label--normal' : ''
                }`}
              >
                {plan.includesLabel ?? 'Inclui'}
              </p>
              <ul className="lt-plan-card__features lt-plan-card__features--included">
                {plan.includes.map((item) => (
                  <li key={item}>
                    <Check size={16} strokeWidth={2.5} aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            {plan.excludes?.length ? (
              <div className="lt-plan-card__feature-group">
                <p className="lt-plan-card__feature-label">Não inclui</p>
                <ul
                  className={`lt-plan-card__features${
                    plan.excludesPositive
                      ? ' lt-plan-card__features--included'
                      : ' lt-plan-card__features--excluded'
                  }`}
                >
                  {plan.excludes.map((item) => (
                    <li key={item}>
                      {plan.excludesPositive ? (
                        <Check size={16} strokeWidth={2.5} aria-hidden />
                      ) : (
                        <X size={16} strokeWidth={2.5} aria-hidden />
                      )}
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : plan.features ? (
          <ul className="lt-plan-card__features">
            {plan.features.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        ) : null}
        <a
          href={LANDING_WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={`lt-btn${plan.featured ? ' lt-btn--primary lt-btn--shine' : ' lt-btn--ghost'}`}
        >
          {price.type === 'consult' ? 'Falar com vendas' : 'Começar agora'}
        </a>
      </>
    );

    if (isStatic) {
      return (
        <article key={plan.id} className={className}>
          {cardBody}
        </article>
      );
    }

    return (
      <TiltCard
        key={plan.id}
        className={className}
        {...(reveal ? { 'data-lt-reveal': true } : {})}
      >
        {cardBody}
      </TiltCard>
    );
  };

  const renderStepCard = (step, { reveal = false } = {}) => {
    const illustrationSrc = STEP_ILLUSTRATIONS[step.icon];

    return (
      <article key={step.step} className="lt-step-card" {...(reveal ? { 'data-lt-reveal': true } : {})}>
        <span className="lt-step-card__num">{step.step}</span>
        <div className="lt-step-card__illus" aria-hidden>
          {illustrationSrc ? (
            <img
              src={illustrationSrc}
              alt=""
              className="lt-step-card__illus-img"
              loading="lazy"
              decoding="async"
            />
          ) : null}
        </div>
        <h3 className="lt-step-card__title">{step.title}</h3>
        <p className="lt-step-card__text">{step.text}</p>
      </article>
    );
  };

  return (
    <div className="lt-page" ref={pageRef}>
      <div className="lt-cursor-glow" ref={glowRef} aria-hidden />

      <div className="lt-bg-orbs" aria-hidden>
        <span className="lt-bg-orb lt-bg-orb--1" />
        <span className="lt-bg-orb lt-bg-orb--2" />
        <span className="lt-bg-orb lt-bg-orb--3" />
      </div>

      <header className={`lt-header${scrolled ? ' is-scrolled' : ''}`}>
        <div className="lt-header__inner">
          <a href="#topo" className="lt-header__logo" onClick={(e) => { e.preventDefault(); scrollToId('topo'); }}>
            <SlootiLogo size="lg" onDark={false} />
          </a>

          <nav className="lt-header__nav" aria-label="Navegação principal">
            {NAV_LINKS.map((link) => (
              <button
                key={link.id}
                type="button"
                className="lt-header__link"
                onClick={() => scrollToId(link.id)}
              >
                {link.label}
              </button>
            ))}
          </nav>

          <button
            type="button"
            className="lt-header__menu-btn"
            aria-expanded={mobileNavOpen}
            aria-controls="lt-mobile-nav"
            aria-label={mobileNavOpen ? 'Fechar menu' : 'Abrir menu'}
            onClick={() => setMobileNavOpen((open) => !open)}
          >
            {mobileNavOpen ? <X size={20} strokeWidth={1.75} /> : <Menu size={20} strokeWidth={1.75} />}
          </button>

          <nav
            id="lt-mobile-nav"
            className={`lt-header__nav-mobile${mobileNavOpen ? ' is-open' : ''}`}
            aria-label="Navegação mobile"
            hidden={!mobileNavOpen}
          >
            {NAV_LINKS.map((link) => (
              <button
                key={link.id}
                type="button"
                className="lt-header__nav-mobile-link"
                onClick={() => scrollToSection(link.id, () => setMobileNavOpen(false))}
              >
                {link.label}
              </button>
            ))}
            <a
              href={LANDING_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="lt-btn lt-btn--primary lt-header__nav-mobile-cta"
              onClick={() => setMobileNavOpen(false)}
            >
              Falar agora
            </a>
          </nav>

          {mobileNavOpen ? (
            <button
              type="button"
              className="lt-header__backdrop"
              aria-label="Fechar menu"
              onClick={() => setMobileNavOpen(false)}
            />
          ) : null}

          <a
            href={LANDING_WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="lt-btn lt-btn--primary lt-btn--sm lt-header__cta"
          >
            Falar agora
          </a>
        </div>
      </header>

      <main>
        <section id="topo" className="lt-hero" ref={heroRef}>
          <div className="lt-hero-card">
            <span className="lt-hero-card__glow lt-hero-card__glow--tr" aria-hidden />
            <span className="lt-hero-card__glow lt-hero-card__glow--bl" aria-hidden />
            <div className="lt-hero-card__arcs" aria-hidden />

            <div className="lt-hero-card__inner">
              <div className="lt-hero-card__content">
                  <h1 className="lt-hero__title" data-lt-hero>
                  Agendamentos inteligentes para barbearias{' '}
                  <span className="lt-hero__word" key={wordIndex}>
                    {HERO_ROTATING_WORDS[wordIndex]}.
                  </span>
                </h1>

                <p className="lt-hero__subtitle" data-lt-hero>
                  A Slooti transforma sua agenda em uma experiência simples, rápida e profissional —
                  para o cliente agendar sozinho e você focar no atendimento.
                </p>

                <div className="lt-hero__actions" data-lt-hero>
                  <a
                    href={LANDING_WHATSAPP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="lt-btn lt-btn--primary lt-btn--shine"
                  >
                    Começar agora
                  </a>
                  <button
                    type="button"
                    className="lt-btn lt-btn--ghost lt-btn--glass"
                    onClick={() => scrollToId('como-funciona')}
                  >
                    Como funciona
                  </button>
                </div>
              </div>

              {!isMobileLanding ? (
                <div className="lt-hero__visual" data-lt-hero>
                  <PhoneMockup />
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {!isMobileLanding ? (
          <>
            <SectionDivider />
            <section className="lt-pain" data-lt-reveal>
              <div className="lt-container lt-pain__inner">
                <h2 className="lt-section-title">{PAIN_SECTION.title}</h2>
                <p className="lt-section-text">{PAIN_SECTION.text}</p>
              </div>
            </section>
          </>
        ) : null}

        <SectionDivider />

        <section
          className="lt-scroll-text"
          ref={scrollSectionRef}
          aria-label="Benefícios em destaque"
          aria-live={isMobileLanding ? 'polite' : undefined}
        >
          <SectionDivider dark />
          <div className="lt-scroll-text__inner">
            {SCROLL_PHRASES.map((phrase, i) => (
              <p
                key={phrase}
                className="lt-scroll-text__phrase"
                ref={(el) => { phraseRefs.current[i] = el; }}
                style={{ opacity: i === 0 ? 1 : 0 }}
              >
                {phrase}
              </p>
            ))}
          </div>
        </section>

        <SectionDivider />

        <section id="beneficios" className="lt-benefits">
          <div className="lt-container">
            <header className="lt-section-head" data-lt-reveal>
              <h2 className="lt-section-title">Tudo que sua barbearia precisa</h2>
              <p className="lt-section-text">
                Ferramentas pensadas para simplificar a rotina e elevar a experiência do cliente.
              </p>
            </header>

            <div ref={bindBenefitsCarouselRef} className="lt-benefits__carousel" data-lt-reveal>
              <div
                className="lt-benefits__stage"
                aria-live="polite"
                aria-roledescription="carrossel"
                aria-label="Benefícios da plataforma"
              >
                <div className="lt-benefits__track">
                  {BENEFITS.map((item, index) => {
                    const Icon = BENEFIT_ICONS[item.icon];
                    const offset = getCircularOffset(index, activeBenefit, BENEFITS.length);
                    const isActive = offset === 0;
                    const isAdjacent = Math.abs(offset) === 1;

                    return (
                      <article
                        key={item.title}
                        className={`lt-benefit-card${isActive ? ' is-active' : ''}${isAdjacent ? ' is-adjacent' : ''}`}
                        style={getBenefitCardStyle(index, activeBenefit)}
                        onClick={() => {
                          if (isAdjacent) goToBenefit(index);
                        }}
                        aria-hidden={!isActive && Math.abs(offset) > 1}
                      >
                        <span className="lt-benefit-card__icon" aria-hidden>
                          {Icon ? <Icon size={22} strokeWidth={1.75} /> : null}
                        </span>
                        <h3 className="lt-benefit-card__title">{item.title}</h3>
                        <p className="lt-benefit-card__text">{item.text}</p>
                        <span className="lt-benefit-card__shine" aria-hidden />
                      </article>
                    );
                  })}
                </div>
              </div>

              <div className="lt-benefits__nav-row">
                <button
                  type="button"
                  className="lt-benefits__nav"
                  aria-label="Benefício anterior"
                  onClick={prevBenefit}
                >
                  <ChevronLeft size={22} strokeWidth={2.25} aria-hidden />
                </button>

                <div className="lt-benefits__dots" role="tablist" aria-label="Benefícios">
                  {BENEFITS.map((item, index) => (
                    <button
                      key={item.title}
                      type="button"
                      role="tab"
                      aria-selected={activeBenefit === index}
                      aria-label={item.title}
                      className={`lt-benefits__dot${activeBenefit === index ? ' is-active' : ''}`}
                      onClick={() => goToBenefit(index)}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  className="lt-benefits__nav"
                  aria-label="Próximo benefício"
                  onClick={nextBenefit}
                >
                  <ChevronRight size={22} strokeWidth={2.25} aria-hidden />
                </button>
              </div>
            </div>

            {isMobileLanding ? (
              <div className="lt-benefits__phone" data-lt-reveal>
                <PhoneMockup />
              </div>
            ) : null}
          </div>
        </section>

        <SectionDivider />

        <section id="como-funciona" className="lt-steps">
          <div className="lt-container">
            <header className="lt-section-head" data-lt-reveal>
              <h2 className="lt-section-title">Como funciona</h2>
              <p className="lt-section-text">Três passos para colocar sua agenda online.</p>
            </header>

            {isMobileLanding ? (
              <div className="lt-steps__carousel">
                <div
                  ref={stepsViewportRef}
                  className="lt-steps__viewport"
                  aria-live="polite"
                  aria-roledescription="carrossel"
                  aria-label="Passos para usar a Slooti"
                >
                  <div
                    className="lt-steps__track"
                    style={{ transform: `translateX(-${activeStep * 100}%)` }}
                  >
                    {STEPS.map((step) => renderStepCard(step))}
                  </div>
                </div>

                <div className="lt-steps__dots" role="tablist" aria-label="Passos">
                  {STEPS.map((step, index) => (
                    <button
                      key={step.step}
                      type="button"
                      role="tab"
                      aria-selected={activeStep === index}
                      aria-label={`Passo ${step.step}: ${step.title}`}
                      className={`lt-steps__dot${activeStep === index ? ' is-active' : ''}`}
                      onClick={() => setActiveStep(index)}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="lt-steps__grid">
                {STEPS.map((step) => renderStepCard(step, { reveal: true }))}
              </div>
            )}
          </div>
        </section>

        {!isMobileLanding ? (
          <>
            <SectionDivider />
            <section className="lt-metrics" ref={metricsRef} data-lt-reveal>
              <div className="lt-container lt-metrics__grid">
                {METRICS.map((m) => (
                  <div key={m.label} className="lt-metric">
                    <span
                      className="lt-metric__value"
                      data-lt-counter={m.value}
                      data-lt-prefix={m.prefix}
                      data-lt-suffix={m.suffix}
                    >
                      {m.prefix}0{m.suffix}
                    </span>
                    <span className="lt-metric__label">{m.label}</span>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : null}

        <SectionDivider />

        <section id="planos" className="lt-pricing">
          <div className="lt-container">
            <header className="lt-section-head" data-lt-reveal>
              <h2 className="lt-section-title">Planos</h2>
              <p className="lt-section-text">Escolha o plano ideal para o momento da sua barbearia.</p>

              <div className="lt-pricing__billing" role="tablist" aria-label="Período de cobrança">
                {BILLING_OPTIONS.map((option) => {
                  const isActive = billing === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      className={`lt-pricing__billing-option${isActive ? ' is-active' : ''}`}
                      onClick={() => setBilling(option.id)}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </header>

            {isMobileLanding ? (
              <div className="lt-pricing__carousel">
                <div
                  ref={pricingViewportRef}
                  className="lt-pricing__viewport"
                  aria-live="polite"
                >
                  <div
                    className="lt-pricing__track"
                    style={{ transform: `translateX(-${activePlan * 100}%)` }}
                  >
                    {MOBILE_PLANS.map((plan) => renderPlanCard(plan, { static: true }))}
                  </div>
                </div>

                <div className="lt-pricing__nav-row">
                  <button
                    type="button"
                    className="lt-pricing__nav"
                    aria-label="Plano anterior"
                    disabled={activePlan === 0}
                    onClick={() => goToPlan(activePlan - 1)}
                  >
                    <ChevronLeft size={22} strokeWidth={2.25} aria-hidden />
                  </button>

                  <div className="lt-pricing__dots" role="tablist" aria-label="Planos">
                    {MOBILE_PLANS.map((plan, index) => (
                      <button
                        key={plan.id}
                        type="button"
                        role="tab"
                        aria-selected={activePlan === index}
                        aria-label={plan.name}
                        className={`lt-pricing__dot${activePlan === index ? ' is-active' : ''}`}
                        onClick={() => goToPlan(index)}
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    className="lt-pricing__nav"
                    aria-label="Próximo plano"
                    disabled={activePlan === MOBILE_PLANS.length - 1}
                    onClick={() => goToPlan(activePlan + 1)}
                  >
                    <ChevronRight size={22} strokeWidth={2.25} aria-hidden />
                  </button>
                </div>
              </div>
            ) : (
              <div className="lt-pricing__grid">
                {PLANS.map((plan) => renderPlanCard(plan, { reveal: true }))}
              </div>
            )}
          </div>
        </section>

        <SectionDivider />

        <section id="faq" className="lt-faq">
          <div className="lt-container lt-faq__inner">
            <header className="lt-section-head" data-lt-reveal>
              <h2 className="lt-section-title">Perguntas frequentes</h2>
            </header>

            <div className="lt-faq__list" data-lt-reveal>
              {FAQ_ITEMS.map((item, i) => {
                const isOpen = openFaq === i;
                return (
                  <div key={item.question} className={`lt-faq__item${isOpen ? ' is-open' : ''}`}>
                    <button
                      type="button"
                      className="lt-faq__question"
                      aria-expanded={isOpen}
                      onClick={() => setOpenFaq(isOpen ? -1 : i)}
                    >
                      {item.question}
                      <span className="lt-faq__icon" aria-hidden />
                    </button>
                    <div className="lt-faq__answer" style={{ maxHeight: isOpen ? '240px' : '0' }}>
                      <p>{item.answer}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <SectionDivider />

        <section className="lt-final-cta" data-lt-reveal>
          <div className="lt-container lt-final-cta__inner">
            <h2 className="lt-final-cta__title">Pronto para modernizar sua barbearia?</h2>
            <p className="lt-final-cta__text">
              Com a Slooti, seus clientes agendam mais fácil e sua barbearia trabalha com mais
              organização.
            </p>
            <a
              href={LANDING_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="lt-btn lt-btn--primary lt-btn--shine lt-btn--lg"
            >
              Começar agora
            </a>
          </div>
        </section>
      </main>

      <footer className="lt-footer">
        <div className="lt-container lt-footer__inner">
          <SlootiLogo size="md" onDark={false} />
          <p className="lt-footer__text">Sistema de agendamento para barbearias modernas.</p>
          <p className="lt-footer__copy">© {new Date().getFullYear()} Slooti. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
