import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function scrollToId(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function useStellarMotion(pageRef) {
  const headerRef = useRef(null);

  useEffect(() => {
    const page = pageRef.current;
    if (!page) return undefined;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctx = gsap.context(() => {
      const header = headerRef.current;
      if (header) {
        ScrollTrigger.create({
          start: 24,
          onUpdate: (self) => {
            header.classList.toggle('is-solid', self.scroll() > 24);
          },
        });
      }

      if (reduced) {
        gsap.set(page.querySelectorAll('[data-hero-fade], [data-reveal]'), {
          opacity: 1,
          y: 0,
        });
        return;
      }

      gsap.fromTo(
        page.querySelectorAll('[data-hero-fade]'),
        { opacity: 0, y: 28 },
        { opacity: 1, y: 0, duration: 1, stagger: 0.12, ease: 'power3.out', delay: 0.1 },
      );

      page.querySelectorAll('[data-reveal]').forEach((el) => {
        gsap.fromTo(
          el,
          { opacity: 0, y: 36 },
          {
            opacity: 1,
            y: 0,
            duration: 0.9,
            ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 88%' },
          },
        );
      });
    }, page);

    return () => {
      ctx.revert();
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, [pageRef]);

  return headerRef;
}
