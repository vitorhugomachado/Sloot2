import { useEffect, useRef, useState } from 'react';

/**
 * Dispara quando o elemento entra na viewport (Intersection Observer).
 * @param {{ rootMargin?: string, threshold?: number, once?: boolean }} options
 */
export function useInView(options = {}) {
  const { rootMargin = '0px 0px -8% 0px', threshold = 0.12, once = true } = options;
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { rootMargin, threshold },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [rootMargin, threshold, once]);

  return [ref, inView];
}
