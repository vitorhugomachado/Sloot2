import { useState } from 'react';
import {
  LANDING_TESTIMONIALS,
  LANDING_TESTIMONIAL_CTA,
} from './landingTestimonial.config';
import './landing-testimonial.css';

export default function LandingTestimonial() {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = LANDING_TESTIMONIALS[activeIndex];

  return (
    <section id="depoimentos" className="landing-testimonial" aria-labelledby="landing-testimonial-title">
      <div className="landing-testimonial__inner">
        <div className="landing-testimonial__card" data-landing-animate>
          <div
            className="landing-testimonial__brands"
            role="tablist"
            aria-label="Depoimentos por barbearia"
          >
            {LANDING_TESTIMONIALS.map((item, index) => {
              const isActive = index === activeIndex;

              return (
                <button
                  key={item.brand}
                  type="button"
                  role="tab"
                  id={`landing-testimonial-tab-${index}`}
                  aria-selected={isActive}
                  aria-controls="landing-testimonial-panel"
                  tabIndex={isActive ? 0 : -1}
                  className={`landing-testimonial__brand${isActive ? ' is-active' : ''}`}
                  onClick={() => setActiveIndex(index)}
                >
                  {item.brand}
                </button>
              );
            })}
          </div>

          <div
            id="landing-testimonial-panel"
            role="tabpanel"
            aria-labelledby={`landing-testimonial-tab-${activeIndex}`}
            className="landing-testimonial__panel"
          >
            <blockquote className="landing-testimonial__quote">
              <p id="landing-testimonial-title">“{active.quote}”</p>
            </blockquote>

            <footer className="landing-testimonial__footer">
              <cite className="landing-testimonial__author">
                {active.author}
                <span className="landing-testimonial__role">{active.role}</span>
              </cite>
              <a href={active.fullStoryHref} className="landing-testimonial__cta">
                {LANDING_TESTIMONIAL_CTA.label}
              </a>
            </footer>
          </div>
        </div>
      </div>
    </section>
  );
}
