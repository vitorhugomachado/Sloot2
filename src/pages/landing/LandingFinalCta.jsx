import { Link } from 'react-router-dom';
import { DEFAULT_SLUG } from '../../context/TenantContext';
import { tenantBookingPath } from '../../constants/tenantRoutes';
import { LANDING_FINAL_CTA } from './landingFinalCta.config';
import './landing-final-cta.css';

const DEMO_BOOKING = tenantBookingPath(DEFAULT_SLUG);

export default function LandingFinalCta() {
  const { title, subtitle, primaryCta, secondaryCta } = LANDING_FINAL_CTA;

  return (
    <section className="landing-final-cta" aria-labelledby="landing-final-cta-title">
      <div className="landing-final-cta__inner">
        <div className="landing-final-cta__card" data-landing-animate>
          <h2 id="landing-final-cta-title" className="landing-final-cta__title">
            {title}
          </h2>
          <p className="landing-final-cta__subtitle">{subtitle}</p>

          <div className="landing-final-cta__actions">
            <Link to={DEMO_BOOKING} className="landing-final-cta__cta is-primary">
              {primaryCta.label}
            </Link>
            <Link to={secondaryCta.to} className="landing-final-cta__cta is-secondary">
              {secondaryCta.label}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
