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
            const price = getPlanPriceDisplay(plan, billing);

            return (
              <article
                key={plan.id}
                className={`landing-pricing__card${plan.featured ? ' is-featured' : ''}`}
                data-landing-animate
              >
                <div className="landing-pricing__media">
                  <img src={plan.image} alt={plan.imageAlt} loading="lazy" decoding="async" />
                </div>

                <div className="landing-pricing__body">
                  <div className="landing-pricing__meta">
                    <span className="landing-pricing__tag">{plan.tag}</span>
                    <div className="landing-pricing__price-wrap">
                      <span className="landing-pricing__price">
                        {price.main}
                        {price.suffix ? (
                          <span className="landing-pricing__period">{price.suffix}</span>
                        ) : null}
                      </span>
                      {price.note ? (
                        <span className="landing-pricing__price-note">{price.note}</span>
                      ) : null}
                    </div>
                  </div>

                  <h3 className="landing-pricing__name">{plan.name}</h3>
                  <p className="landing-pricing__desc">{plan.description}</p>

                  <ul className="landing-pricing__list">
                    {plan.highlights.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>

                  <CtaTag {...ctaProps} className="landing-pricing__cta">
                    {plan.cta.label}
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
