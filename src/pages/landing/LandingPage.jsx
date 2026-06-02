import { useCallback, useEffect, useRef, useState } from 'react';
import LandingGlassNav from './LandingGlassNav';
import LandingHero from './LandingHero';
import LandingHeroCard from './LandingHeroCard';
import LandingFeatureRows from './LandingFeatureRows';
import LandingTestimonial from './LandingTestimonial';
import LandingPricing from './LandingPricing';
import LandingFooter from './LandingFooter';
import { gsap, SLOOTI_EASE } from './gsap';
import './landing.css';

export default function LandingPage() {
  const pageRef = useRef(null);
  const [navVisible, setNavVisible] = useState(false);

  const handleCapsuleNavReady = useCallback((ready) => {
    setNavVisible(ready);
  }, []);

  useEffect(() => {
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
      <LandingGlassNav visible={navVisible} />

      <main className="landing-page__main" aria-label="Landing Slooti">
        <LandingHero onCapsuleNavReady={handleCapsuleNavReady} />
        <LandingHeroCard />
        <LandingFeatureRows />
        <LandingPricing />
        <LandingTestimonial />
      </main>

      <LandingFooter />
    </div>
  );
}
