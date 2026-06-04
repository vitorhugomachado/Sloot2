import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DEFAULT_SLUG } from '../../context/TenantContext';
import { tenantBookingPath } from '../../constants/tenantRoutes';
import {
  DEFAULT_LANDING_BILLING,
  getPlanPriceDisplay,
  LANDING_BILLING_OPTIONS,
  LANDING_PLANS,
} from './landingPricing.config';
import './landing-pricing.css';

const DEMO_BOOKING = tenantBookingPath(DEFAULT_SLUG);

function PriceBlock({ plan, billing, featured }) {
  const price = getPlanPriceDisplay(plan, billing);

  if (price.type === 'consult') {
    return (
      <div className="landing-pricing__price-block">
        <span className="landing-pricing__price-eyebrow">Sob consulta</span>
        <p className="landing-pricing__price landing-pricing__price--consult">Sob consulta</p>
      </div>
    );
  }

  return (
    <div className="landing-pricing__price-block">
      <p className={`landing-pricing__price${featured ? ' is-accent' : ''}`}>
        <span className="landing-pricing__price-currency">R$</span>
        <span className="landing-pricing__price-value">{price.value}</span>
        <span className="landing-pricing__period">/mês</span>
      </p>
      {price.pill ? (
        <span className={`landing-pricing__pill${featured ? ' is-accent' : ''}`}>{price.pill}</span>
      ) : null}
      {price.note ? <span className="landing-pricing__price-note">{price.note}</span> : null}
    </div>
  );
}

export default function LandingPricing() {
  const [billing, setBilling] = useState(DEFAULT_LANDING_BILLING);

  return (
    <section id="planos" className="landing-pricing" aria-labelledby="landing-pricing-title">
      <div className="landing-pricing__inner">
        <header className="landing-pricing__header" data-landing-animate>
          <h2 id="landing-pricing-title" className="landing-pricing__title">
            Planos Slooti
          </h2>

          <div
            className="landing-pricing__billing"
            role="tablist"
            aria-label="Período de cobrança"
          >
            {LANDING_BILLING_OPTIONS.map((option) => {
              const isActive = billing === option.id;

              return (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`landing-pricing__billing-option${isActive ? ' is-active' : ''}`}
                  onClick={() => setBilling(option.id)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <a href="#contato" className="landing-pricing__link-all">
            Comparar todos
          </a>
        </header>

        <div className="landing-pricing__grid">
          {LANDING_PLANS.map((plan) => {
            const href = plan.cta.href ?? DEMO_BOOKING;
            const CtaTag = plan.cta.href === null ? Link : 'a';
            const ctaProps = plan.cta.href === null ? { to: href } : { href };

            return (
              <article
                key={plan.id}
                className={`landing-pricing__card${plan.featured ? ' is-featured' : ''}`}
                data-landing-animate
              >
                <div className="landing-pricing__media">
                  <span
                    className={`landing-pricing__tag landing-pricing__tag--${plan.tagTone || 'accent'}`}
                  >
                    {plan.tag}
                  </span>
                  <img src={plan.image} alt={plan.imageAlt} loading="lazy" decoding="async" />
                </div>

                <div className="landing-pricing__body">
                  <h3 className="landing-pricing__name">{plan.name}</h3>
                  <p className="landing-pricing__desc">{plan.description}</p>

                  <PriceBlock plan={plan} billing={billing} featured={plan.featured} />

                  <hr className="landing-pricing__divider" aria-hidden />

                  <ul className="landing-pricing__list">
                    {plan.highlights.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>

                  <CtaTag {...ctaProps} className="landing-pricing__cta">
                    <span>{plan.cta.label}</span>
                    <span className="landing-pricing__cta-arrow" aria-hidden>
                      →
                    </span>
                  </CtaTag>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
