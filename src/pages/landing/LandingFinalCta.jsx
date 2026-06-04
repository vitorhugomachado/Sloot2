import { LANDING_FINAL_CTA } from './landingFinalCta.config';
import { LANDING_WHATSAPP_URL } from './landingContact.config';
import './landing-final-cta.css';

export default function LandingFinalCta() {
  const { title, subtitle, primaryCta } = LANDING_FINAL_CTA;

  return (
    <section className="landing-final-cta" aria-labelledby="landing-final-cta-title">
      <div className="landing-final-cta__inner">
        <div className="landing-final-cta__card" data-landing-animate>
          <h2 id="landing-final-cta-title" className="landing-final-cta__title">
            {title}
          </h2>
          <p className="landing-final-cta__subtitle">{subtitle}</p>

          <div className="landing-final-cta__actions">
            <a
              href={LANDING_WHATSAPP_URL}
              className="landing-final-cta__cta is-primary"
              target="_blank"
              rel="noopener noreferrer"
            >
              {primaryCta.label}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
