import { useEffect, useRef, useState } from 'react';
import { gsap, SLOOTI_EASE } from './gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function useHeaderBlur() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return scrolled;
}

export function useCursorGlow(pageRef) {
  const glowRef = useRef(null);

  useEffect(() => {
    const page = pageRef.current;
    const glow = glowRef.current;
    if (!page || !glow) return undefined;

    const finePointer = window.matchMedia('(pointer: fine)').matches;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!finePointer || reduceMotion) return undefined;

    const onMove = (e) => {
      gsap.to(glow, {
        x: e.clientX,
        y: e.clientY,
        duration: 0.45,
        ease: 'power2.out',
      });
    };

    page.addEventListener('mousemove', onMove);
    return () => page.removeEventListener('mousemove', onMove);
  }, [pageRef]);

  return glowRef;
}

export function useHeroEntrance(heroRef) {
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return undefined;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return undefined;

    const ctx = gsap.context(() => {
      gsap.from('[data-lt-hero]', {
        opacity: 0,
        y: 36,
        duration: 1,
        stagger: 0.12,
        ease: SLOOTI_EASE,
        delay: 0.1,
      });
      gsap.from('.lt-phone', {
        opacity: 0,
        y: 48,
        scale: 0.94,
        duration: 1.2,
        ease: SLOOTI_EASE,
        delay: 0.35,
      });
    }, el);

    return () => ctx.revert();
  }, [heroRef]);
}

export function useScrollReveal(pageRef) {
  useEffect(() => {
    const root = pageRef.current;
    if (!root) return undefined;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return undefined;

    const ctx = gsap.context(() => {
      gsap.utils.toArray('[data-lt-reveal]').forEach((el) => {
        gsap.from(el, {
          opacity: 0,
          y: 40,
          duration: 0.9,
          ease: SLOOTI_EASE,
          scrollTrigger: {
            trigger: el,
            start: 'top 88%',
            toggleActions: 'play none none none',
          },
        });
      });
    }, root);

    return () => ctx.revert();
  }, [pageRef]);
}

export function useScrollPhrases(sectionRef, phraseRefs) {
  useEffect(() => {
    const section = sectionRef.current;
    const phrases = phraseRefs.current.filter(Boolean);
    if (!section || phrases.length === 0) return undefined;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      phrases.forEach((p, i) => {
        p.style.opacity = i === 0 ? '1' : '0';
      });
      return undefined;
    }

    const isMobile = window.matchMedia('(max-width: 767px)').matches;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: isMobile ? `+=${phrases.length * 55}%` : `+=${phrases.length * 100}%`,
          pin: !isMobile,
          scrub: isMobile ? 0.85 : 0.6,
          invalidateOnRefresh: true,
        },
      });

      phrases.forEach((phrase, i) => {
        if (i === 0) {
          tl.fromTo(phrase, { opacity: 1, y: 0 }, { opacity: 1, y: 0, duration: 0.25 });
        } else {
          tl.to(phrases[i - 1], { opacity: 0, y: -40, duration: 0.4 });
          tl.fromTo(phrase, { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 0.4 }, '<0.1');
        }
        if (i < phrases.length - 1) {
          tl.to({}, { duration: 0.35 });
        }
      });
    }, section);

    return () => ctx.revert();
  }, [sectionRef, phraseRefs]);
}

export function useAnimatedCounters(sectionRef) {
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return undefined;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const counters = section.querySelectorAll('[data-lt-counter]');

    const animate = (el) => {
      const target = Number(el.dataset.ltCounter);
      const prefix = el.dataset.ltPrefix || '';
      const suffix = el.dataset.ltSuffix || '';
      if (reduceMotion) {
        el.textContent = `${prefix}${target}${suffix}`;
        return;
      }
      const obj = { val: 0 };
      gsap.to(obj, {
        val: target,
        duration: 2,
        ease: 'power2.out',
        onUpdate: () => {
          el.textContent = `${prefix}${Math.round(obj.val)}${suffix}`;
        },
      });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animate(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.4 },
    );

    counters.forEach((c) => observer.observe(c));
    return () => observer.disconnect();
  }, [sectionRef]);
}

export function useBackgroundOrbs(pageRef) {
  useEffect(() => {
    const root = pageRef.current;
    if (!root) return undefined;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    if (reduceMotion || isMobile) return undefined;

    const orbs = root.querySelectorAll('.lt-bg-orb');
    const ctx = gsap.context(() => {
      orbs.forEach((orb, i) => {
        gsap.to(orb, {
          x: i % 2 === 0 ? 30 : -24,
          y: i % 2 === 0 ? -20 : 28,
          duration: 6 + i * 1.5,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        });
      });
    }, root);

    return () => ctx.revert();
  }, [pageRef]);
}
