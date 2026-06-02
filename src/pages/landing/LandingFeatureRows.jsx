import { LANDING_FEATURE_ROWS } from './landingFeatures.config';
import './landing-jelly-card.css';
import './landing-features.css';

export default function LandingFeatureRows() {
  return (
    <section className="landing-features" aria-label="Recursos Slooti">
      <div className="landing-features__inner">
        {LANDING_FEATURE_ROWS.map((row) => (
          <article
            key={row.id}
            id={row.id === 'agenda' ? 'plataforma' : row.id === 'equipe' ? 'recursos' : undefined}
            className={`landing-features__row${row.reverse ? ' is-reverse' : ''}`}
          >
            <div className="landing-features__copy" data-landing-animate>
              <h2 className="landing-features__title">{row.title}</h2>
              <p className="landing-features__body">{row.body}</p>
            </div>

            <div className="landing-features__media" data-landing-animate>
              <div className="landing-features__card jelly-card">
                <img
                  className="landing-features__image"
                  src={row.image}
                  alt={row.imageAlt}
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
