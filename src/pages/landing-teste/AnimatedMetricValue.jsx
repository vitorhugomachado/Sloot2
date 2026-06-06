import { useEffect, useRef, useState } from 'react';
import { gsap } from './gsap';

export default function AnimatedMetricValue({ value, prefix = '', suffix = '' }) {
  const ref = useRef(null);
  const animated = useRef(false);
  const tweenRef = useRef(null);
  const [display, setDisplay] = useState(`${prefix}0${suffix}`);

  useEffect(() => {
    animated.current = false;
    setDisplay(`${prefix}0${suffix}`);
  }, [value, prefix, suffix]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const run = () => {
      if (animated.current) return;
      animated.current = true;

      if (reduceMotion) {
        setDisplay(`${prefix}${value}${suffix}`);
        return;
      }

      const obj = { val: 0 };
      tweenRef.current = gsap.to(obj, {
        val: value,
        duration: 2,
        ease: 'power2.out',
        onUpdate: () => {
          setDisplay(`${prefix}${Math.round(obj.val)}${suffix}`);
        },
      });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) run();
        });
      },
      { threshold: 0.35 },
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
      tweenRef.current?.kill();
      tweenRef.current = null;
    };
  }, [value, prefix, suffix]);

  return (
    <span ref={ref} className="lt-metric__value">
      {display}
    </span>
  );
}
