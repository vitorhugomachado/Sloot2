import { useEffect, useRef } from 'react';
import LandingGlassNav from './LandingGlassNav';
import LandingHeroCard from './LandingHeroCard';
import LandingFeatureRows from './LandingFeatureRows';
import LandingTestimonial from './LandingTestimonial';
import LandingPricing from './LandingPricing';
import LandingFinalCta from './LandingFinalCta';
import LandingFooter from './LandingFooter';
import { gsap, SLOOTI_EASE } from './gsap';
import './landing.css';

export default function LandingPage() {
  const pageRef = useRef(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isNarrow = window.matchMedia('(max-width: 767px)').matches;
    if (reduceMotion || isNarrow) return undefined;

    const ctx = gsap.context(() => {
      gsap.from('[data-landing-animate]', {
        opacity: 0,
        y: 28,
        duration: 0.85,
        stagger: 0.14,
        ease: SLOOTI_EASE,
        delay: 0.15,
      });
    }, pageRef);

    return () => ctx.revert();
  }, []);

  return (
    <div className="landing-page" ref={pageRef}>
      <LandingGlassNav visible />

      <main className="landing-page__main" aria-label="Landing Slooti">
        <LandingHeroCard />
        <LandingFeatureRows />
        <LandingPricing />
        <LandingTestimonial />
      </main>

      <LandingFinalCta />
      <LandingFooter />
    </div>
  );
}
