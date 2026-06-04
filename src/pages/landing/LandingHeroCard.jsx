import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import SlootiLogo from '../../components/SlootiLogo';
import { DEFAULT_SLUG } from '../../context/TenantContext';
import { tenantBookingPath } from '../../constants/tenantRoutes';
import {
  LANDING_HERO_AUTOPLAY_MS,
  LANDING_HERO_SLIDES,
} from './landingHero.config';
import './landing-hero-card.css';

const DEMO_BOOKING = tenantBookingPath(DEFAULT_SLUG);
const SLIDE_COUNT = LANDING_HERO_SLIDES.length;
const SWIPE_THRESHOLD_PX = 48;
const DRAG_CLICK_GUARD_PX = 8;

export default function LandingHeroCard() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const dragRef = useRef({ startX: 0, pointerId: null, didDrag: false });
  const carouselRef = useRef(null);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);

    const onChange = (event) => setPrefersReducedMotion(event.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const goToSlide = useCallback((index) => {
    setActiveIndex((index + SLIDE_COUNT) % SLIDE_COUNT);
  }, []);

  const goNext = useCallback(() => {
    setActiveIndex((index) => (index + 1) % SLIDE_COUNT);
  }, []);

  const goPrev = useCallback(() => {
    setActiveIndex((index) => (index - 1 + SLIDE_COUNT) % SLIDE_COUNT);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion || isDragging) return undefined;

    const id = window.setInterval(goNext, LANDING_HERO_AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [prefersReducedMotion, isDragging, goNext]);

  const finishDrag = useCallback(
    (clientX) => {
      const { startX, didDrag } = dragRef.current;
      const delta = clientX - startX;

      if (didDrag && Math.abs(delta) >= SWIPE_THRESHOLD_PX) {
        if (delta < 0) goNext();
        else goPrev();
      }

      dragRef.current = { startX: 0, pointerId: null, didDrag: false };
      setIsDragging(false);
      setDragOffset(0);
    },
    [goNext, goPrev],
  );

  const handlePointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    dragRef.current = {
      startX: event.clientX,
      pointerId: event.pointerId,
      didDrag: false,
    };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if (dragRef.current.pointerId !== event.pointerId) return;

    const delta = event.clientX - dragRef.current.startX;
    if (Math.abs(delta) > DRAG_CLICK_GUARD_PX) {
      dragRef.current.didDrag = true;
    }

    const maxOffset = carouselRef.current?.offsetWidth
      ? carouselRef.current.offsetWidth * 0.35
      : 120;
    const clamped = Math.max(-maxOffset, Math.min(maxOffset, delta));
    setDragOffset(clamped);
  };

  const handlePointerUp = (event) => {
    if (dragRef.current.pointerId !== event.pointerId) return;
    finishDrag(event.clientX);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handlePointerCancel = (event) => {
    if (dragRef.current.pointerId !== event.pointerId) return;
    finishDrag(event.clientX);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      goNext();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goPrev();
    }
  };

  const activeSlide = LANDING_HERO_SLIDES[activeIndex];

  return (
    <section
      className="landing-hero-card"
      aria-roledescription="carrossel"
      aria-label="Destaques do software Slooti"
      aria-labelledby={`landing-hero-card-title-${activeSlide.id}`}
    >
      <div className="landing-hero-card__inner">
        <article className="landing-hero-card__card" data-landing-animate>
          <button
            type="button"
            className="landing-hero-card__nav landing-hero-card__nav--prev"
            aria-label="Slide anterior"
            onClick={goPrev}
          >
            <ChevronLeft size={20} strokeWidth={2} aria-hidden />
          </button>

          <button
            type="button"
            className="landing-hero-card__nav landing-hero-card__nav--next"
            aria-label="Próximo slide"
            onClick={goNext}
          >
            <ChevronRight size={20} strokeWidth={2} aria-hidden />
          </button>

          <div
            ref={carouselRef}
            className={`landing-hero-card__carousel${isDragging ? ' is-dragging' : ''}`}
            tabIndex={0}
            role="region"
            aria-label="Arraste para o lado ou use as setas para trocar de slide"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onKeyDown={handleKeyDown}
            style={{
              transform: dragOffset ? `translateX(${dragOffset}px)` : undefined,
            }}
          >
            {LANDING_HERO_SLIDES.map((slide, index) => {
              const isActive = index === activeIndex;

              return (
                <div
                  key={slide.id}
                  id={`landing-hero-card-panel-${slide.id}`}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`${index + 1} de ${SLIDE_COUNT}`}
                  aria-hidden={!isActive}
                  className={`landing-hero-card__slide${isActive ? ' is-active' : ''}${
                    slide.variant === 'editorial' ? ' is-editorial' : ''
                  }`}
                >
                  <div
                    className={`landing-hero-card__media${
                      slide.variant === 'editorial' ? ' landing-hero-card__media--editorial' : ''
                    }`}
                  >
                    {slide.variant === 'editorial' ? (
                      <div className="landing-hero-card__editorial" aria-hidden={!isActive}>
                        <SlootiLogo
                          size="xl"
                          onDark
                          className="landing-hero-card__logo-wordmark"
                        />
                      </div>
                    ) : (
                      <img
                        src={slide.image}
                        alt={slide.imageAlt}
                        loading={isActive ? 'eager' : 'lazy'}
                        decoding="async"
                        draggable={false}
                      />
                    )}
                  </div>

                  <div className="landing-hero-card__body" aria-live={isActive ? 'polite' : 'off'}>
                    <p className="landing-hero-card__eyebrow">{slide.eyebrow}</p>
                    {slide.variant === 'editorial' ? (
                      <h2
                        id={`landing-hero-card-title-${slide.id}`}
                        className="landing-hero-card__title landing-hero-card__title--stacked"
                      >
                        {slide.headlineLines.map((line) => (
                          <span
                            key={line.text}
                            className={
                              line.accent
                                ? 'landing-hero-card__title-line is-accent'
                                : 'landing-hero-card__title-line'
                            }
                          >
                            {line.text}
                          </span>
                        ))}
                      </h2>
                    ) : (
                      <h2
                        id={`landing-hero-card-title-${slide.id}`}
                        className="landing-hero-card__title"
                      >
                        {slide.title}
                      </h2>
                    )}
                    {slide.subtitle ? (
                      <p className="landing-hero-card__subtitle">{slide.subtitle}</p>
                    ) : null}

                    <div className="landing-hero-card__actions">
                      <Link to={DEMO_BOOKING} className="landing-hero-card__cta is-primary">
                        {slide.primaryCta.label}
                      </Link>
                      <a href={slide.secondaryCta.href} className="landing-hero-card__cta is-secondary">
                        {slide.secondaryCta.label}
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <div
          className="landing-hero-card__indicators"
          role="tablist"
          aria-label="Slides do hero"
        >
          {LANDING_HERO_SLIDES.map((slide, index) => {
            const isActive = index === activeIndex;

            return (
              <button
                key={slide.id}
                type="button"
                role="tab"
                id={`landing-hero-card-tab-${slide.id}`}
                aria-selected={isActive}
                aria-controls={`landing-hero-card-panel-${slide.id}`}
                tabIndex={isActive ? 0 : -1}
                className={`landing-hero-card__indicator${isActive ? ' is-active' : ''}`}
                onClick={() => goToSlide(index)}
              >
                <span className="landing-hero-card__indicator-label">
                  {slide.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
