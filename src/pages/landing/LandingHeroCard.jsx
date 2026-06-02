import { Link } from 'react-router-dom';
import { DEFAULT_SLUG } from '../../context/TenantContext';
import { tenantBookingPath } from '../../constants/tenantRoutes';
import { LANDING_HERO_MAIN_CARD } from './landingHero.config';
import './landing-hero-card.css';

const DEMO_BOOKING = tenantBookingPath(DEFAULT_SLUG);

export default function LandingHeroCard() {
  const card = LANDING_HERO_MAIN_CARD;

  return (
    <section className="landing-hero-card" aria-labelledby="landing-hero-card-title">
      <div className="landing-hero-card__inner">
        <article className="landing-hero-card__card" data-landing-animate>
          <div className="landing-hero-card__media">
            <img src={card.image} alt={card.imageAlt} loading="lazy" decoding="async" />
          </div>

          <div className="landing-hero-card__body">
            <p className="landing-hero-card__eyebrow">{card.eyebrow}</p>
            <h2 id="landing-hero-card-title" className="landing-hero-card__title">
              {card.title}
            </h2>
            <p className="landing-hero-card__subtitle">{card.subtitle}</p>

            <div className="landing-hero-card__actions">
              <Link to={DEMO_BOOKING} className="landing-hero-card__cta is-primary">
                {card.primaryCta.label}
              </Link>
              <a href={card.secondaryCta.href} className="landing-hero-card__cta is-secondary">
                {card.secondaryCta.label}
              </a>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
