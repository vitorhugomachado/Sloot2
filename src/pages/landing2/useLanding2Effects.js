import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const EASE_OUT = 'power3.out';
const EASE_SOFT = 'expo.out';

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Entrada cinematográfica do hero. */
export function useHeroIntro(heroRef) {
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return undefined;

    if (prefersReducedMotion()) {
      gsap.set(hero.querySelectorAll('[data-hero-fade]'), { opacity: 1, y: 0 });
      gsap.set(hero.querySelectorAll('[data-hero-card]'), { opacity: 1, scale: 1 });
      return undefined;
    }

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: EASE_SOFT } });

      tl.fromTo(
        hero.querySelectorAll('[data-hero-fade]'),
        { opacity: 0, y: 46 },
        { opacity: 1, y: 0, duration: 1.15, stagger: 0.09 },
        0.15,
      );
      tl.fromTo(
        hero.querySelector('[data-hero-price]'),
        { scale: 0.82, opacity: 0 },
        { scale: 1, opacity: 1, duration: 1.3, ease: 'elastic.out(1, 0.68)' },
        0.55,
      );
      tl.fromTo(
        hero.querySelector('[data-hero-phone]'),
        { opacity: 0, y: 80, rotate: 6 },
        { opacity: 1, y: 0, rotate: 0, duration: 1.4 },
        0.4,
      );
      tl.fromTo(
        hero.querySelectorAll('[data-hero-card]'),
        { opacity: 0, scale: 0.7, y: 30 },
        { opacity: 1, scale: 1, y: 0, duration: 0.9, stagger: 0.1, ease: 'back.out(1.7)' },
        0.9,
      );
    }, hero);

    return () => ctx.revert();
  }, [heroRef]);
}

/** Flutuação suave contínua dos cards e do telefone. */
export function useFloating(scopeRef) {
  useEffect(() => {
    const scope = scopeRef.current;
    if (!scope || prefersReducedMotion()) return undefined;

    const ctx = gsap.context(() => {
      scope.querySelectorAll('[data-float]').forEach((el, i) => {
        const amp = 8 + (i % 3) * 5;
        gsap.to(el, {
          y: `+=${amp}`,
          duration: 2.6 + (i % 4) * 0.55,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
          delay: i * 0.28,
        });
      });
    }, scope);

    return () => ctx.revert();
  }, [scopeRef]);
}

/**
 * Scroll story: ILIMITADO quebra em frustrações → caos → explosão → silêncio →
 * "A Slooti faz diferente."
 * Em mobile (≤768px): chips em coluna legível, sem rotação caótica.
 */
export function useScrollStory(sectionRef) {
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return undefined;

    const letters = section.querySelectorAll('[data-story-letter]');
    const chips = section.querySelectorAll('[data-story-chip]');
    const calm = section.querySelector('[data-story-calm]');
    const stage = section.querySelector('[data-story-stage]');
    const isMobile = window.matchMedia('(max-width: 768px)').matches;

    if (prefersReducedMotion()) {
      gsap.set(letters, { opacity: 0 });
      gsap.set(chips, { opacity: 0 });
      gsap.set(calm, { opacity: 1, y: 0 });
      return undefined;
    }

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: isMobile ? '+=220%' : '+=340%',
          pin: stage,
          scrub: 0.8,
        },
      });

      // Fase 1 — a palavra se despedaça
      letters.forEach((letter, i) => {
        const dir = i % 2 === 0 ? -1 : 1;
        tl.to(
          letter,
          {
            x: dir * (isMobile ? 24 + (i % 4) * 10 : 60 + Math.random() * 190),
            y: isMobile ? (i % 2 === 0 ? -40 : 40) : (Math.random() - 0.5) * 300,
            rotate: isMobile ? dir * 8 : dir * (14 + Math.random() * 42),
            opacity: 0.12,
            duration: 1,
            ease: 'power2.inOut',
          },
          0.05 + i * 0.035,
        );
      });

      // Fase 2 — chips
      chips.forEach((chip, i) => {
        if (isMobile) {
          tl.fromTo(
            chip,
            { opacity: 0, y: 28 },
            { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' },
            0.55 + i * 0.08,
          );
        } else {
          tl.fromTo(
            chip,
            { opacity: 0, scale: 0.5, y: 90 },
            { opacity: 1, scale: 1, y: 0, duration: 0.5, ease: 'back.out(2)' },
            0.55 + i * 0.07,
          );
          tl.to(
            chip,
            {
              rotate: `+=${(Math.random() - 0.5) * 14}`,
              duration: 0.9,
              ease: 'sine.inOut',
            },
            0.9 + i * 0.05,
          );
        }
      });

      tl.to(letters, { opacity: 0, duration: 0.4 }, isMobile ? 1.4 : 1.7);

      // Fase 3 — saída
      chips.forEach((chip, i) => {
        if (isMobile) {
          tl.to(
            chip,
            {
              y: -36,
              opacity: 0,
              duration: 0.45,
              ease: 'power2.in',
            },
            2.1 + i * 0.04,
          );
        } else {
          const angle = (i / chips.length) * Math.PI * 2;
          tl.to(
            chip,
            {
              x: `+=${Math.cos(angle) * 900}`,
              y: `+=${Math.sin(angle) * 700}`,
              rotate: `+=${(Math.random() - 0.5) * 200}`,
              opacity: 0,
              scale: 0.4,
              duration: 0.85,
              ease: 'power4.in',
            },
            2.6 + (i % 5) * 0.03,
          );
        }
      });

      // Fase 4 — frase
      tl.fromTo(
        calm,
        { opacity: 0, y: 40, scale: 0.96 },
        { opacity: 1, y: 0, scale: 1, duration: 1.1, ease: EASE_SOFT },
        isMobile ? 2.8 : 3.7,
      );
    }, section);

    return () => ctx.revert();
  }, [sectionRef]);
}

/** Big reveal: badges convergem para o card de preço. */
export function useRevealConverge(sectionRef) {
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return undefined;

    const badges = section.querySelectorAll('[data-reveal-badge]');
    const card = section.querySelector('[data-reveal-card]');
    const title = section.querySelector('[data-reveal-title]');

    if (prefersReducedMotion()) {
      gsap.set(badges, { opacity: 0.9, x: 0, y: 0 });
      gsap.set([card, title], { opacity: 1, y: 0, scale: 1 });
      return undefined;
    }

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top 70%',
          end: 'top 12%',
          scrub: 0.7,
        },
      });

      tl.fromTo(
        title,
        { opacity: 0, y: 60 },
        { opacity: 1, y: 0, duration: 0.8, ease: EASE_OUT },
        0,
      );

      badges.forEach((badge, i) => {
        const angle = (i / badges.length) * Math.PI * 2;
        const radius = 260 + (i % 3) * 130;
        tl.fromTo(
          badge,
          {
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius * 0.7 - 40,
            opacity: 0,
            scale: 0.6,
            rotate: (Math.random() - 0.5) * 30,
          },
          {
            x: 0,
            y: 0,
            opacity: 1,
            scale: 1,
            rotate: 0,
            duration: 1,
            ease: EASE_OUT,
          },
          0.15 + i * 0.04,
        );
      });

      tl.fromTo(
        card,
        { opacity: 0, y: 90, scale: 0.92 },
        { opacity: 1, y: 0, scale: 1, duration: 1, ease: EASE_SOFT },
        0.75,
      );
    }, section);

    return () => ctx.revert();
  }, [sectionRef]);
}

/** Reveal genérico ao rolar (fade-up). */
export function useScrollReveal(pageRef) {
  useEffect(() => {
    const page = pageRef.current;
    if (!page) return undefined;

    if (prefersReducedMotion()) {
      gsap.set(page.querySelectorAll('[data-reveal]'), { opacity: 1, y: 0 });
      return undefined;
    }

    const ctx = gsap.context(() => {
      page.querySelectorAll('[data-reveal]').forEach((el) => {
        gsap.fromTo(
          el,
          { opacity: 0, y: 54 },
          {
            opacity: 1,
            y: 0,
            duration: 1.05,
            ease: EASE_SOFT,
            scrollTrigger: { trigger: el, start: 'top 86%' },
          },
        );
      });

      page.querySelectorAll('[data-reveal-stagger]').forEach((group) => {
        gsap.fromTo(
          group.children,
          { opacity: 0, y: 40 },
          {
            opacity: 1,
            y: 0,
            duration: 0.85,
            stagger: 0.07,
            ease: EASE_OUT,
            scrollTrigger: { trigger: group, start: 'top 84%' },
          },
        );
      });
    }, page);

    return () => ctx.revert();
  }, [pageRef]);
}

/** Luz que segue o mouse (spotlight). */
export function useMouseGlow(pageRef) {
  useEffect(() => {
    const page = pageRef.current;
    if (!page || prefersReducedMotion()) return undefined;
    if (window.matchMedia('(pointer: coarse)').matches) return undefined;

    const onMove = (e) => {
      page.style.setProperty('--lp2-mx', `${e.clientX}px`);
      page.style.setProperty('--lp2-my', `${e.clientY}px`);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [pageRef]);
}

/** Tilt 3D suave nos cards ao passar o mouse. */
export function useTiltCards(scopeRef) {
  useEffect(() => {
    const scope = scopeRef.current;
    if (!scope || prefersReducedMotion()) return undefined;
    if (window.matchMedia('(pointer: coarse)').matches) return undefined;

    const cards = scope.querySelectorAll('[data-tilt]');
    const cleanups = [];

    cards.forEach((card) => {
      const onMove = (e) => {
        const rect = card.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        gsap.to(card, {
          rotateY: px * 7,
          rotateX: -py * 7,
          duration: 0.5,
          ease: 'power2.out',
          transformPerspective: 900,
        });
        card.style.setProperty('--lp2-card-mx', `${((px + 0.5) * 100).toFixed(1)}%`);
        card.style.setProperty('--lp2-card-my', `${((py + 0.5) * 100).toFixed(1)}%`);
      };
      const onLeave = () => {
        gsap.to(card, { rotateY: 0, rotateX: 0, duration: 0.7, ease: 'power3.out' });
      };
      card.addEventListener('pointermove', onMove);
      card.addEventListener('pointerleave', onLeave);
      cleanups.push(() => {
        card.removeEventListener('pointermove', onMove);
        card.removeEventListener('pointerleave', onLeave);
      });
    });

    return () => cleanups.forEach((fn) => fn());
  }, [scopeRef]);
}

/** Contador animado quando entra na viewport. */
export function useCountUp(target, { duration = 1.6, decimals = 0, start = 0 } = {}) {
  const ref = useRef(null);
  const [value, setValue] = useState(start);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    if (prefersReducedMotion()) {
      setValue(target);
      return undefined;
    }

    const obj = { v: start };
    let tween = null;

    const st = ScrollTrigger.create({
      trigger: el,
      start: 'top 88%',
      once: true,
      onEnter: () => {
        tween = gsap.to(obj, {
          v: target,
          duration,
          ease: 'power2.out',
          onUpdate: () => setValue(Number(obj.v.toFixed(decimals))),
        });
      },
    });

    return () => {
      st.kill();
      if (tween) tween.kill();
    };
  }, [target, duration, decimals, start]);

  return [ref, value];
}

/** Header ganha blur/sombra após rolar. */
export function useHeaderState() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return scrolled;
}
