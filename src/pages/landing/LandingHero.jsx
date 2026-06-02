import { useEffect, useRef, useState } from 'react';
import { CAPSULE_SCROLL_HEIGHT_VH, CAPSULE_SCROLL_TEXTS } from './landingHero.config';
import './landing-hero.css';

const TRAIL_PATH =
  'M120,310 C360,40 850,50 1020,190 C1220,390 900,700 660,560 C500,450 690,330 1180,240';

const FALLBACK_PATH_LENGTH = 3000;
const TEXT_SWAP_DELAY_MS = 160;
const TEXT_EXIT_BLUR_PX = 4;
const TEXT_EXIT_OPACITY = 0.4;

function lineToHtml(line) {
  const before = line.before ?? '';
  const accent = line.accent
    ? `<span class="capsule-effect__accent">${line.accent}</span>`
    : '';
  const after = line.after ?? '';
  return `${before}${accent}${after}`;
}

function wordmarkToHtml() {
  return (
    '<span class="slooti-logo slooti-logo--on-dark capsule-effect__wordmark" aria-label="slooti">' +
    'sloot' +
    '<span class="slooti-logo__i" aria-hidden="true">' +
    '<span class="slooti-logo__i-stem">ı</span>' +
    '<span class="slooti-logo__i-dot"></span>' +
    '</span></span>'
  );
}

function slideToHtml(slide) {
  if (slide.wordmark) {
    return wordmarkToHtml();
  }

  const first = lineToHtml(slide.line1);

  if (!slide.line2) {
    return first;
  }

  const second = lineToHtml(slide.line2);
  if (!second) {
    return first;
  }

  return `${first}<br>${second}`;
}

export default function LandingHero({ onCapsuleNavReady }) {
  const sectionRef = useRef(null);
  const trailRef = useRef(null);
  const pathRef = useRef(null);
  const textRef = useRef(null);
  const pathLengthRef = useRef(FALLBACK_PATH_LENGTH);
  const lastIndexRef = useRef(0);
  const lastVisibleRef = useRef(false);
  const progressRef = useRef(0);
  const isAnimatingRef = useRef(false);
  const changeTimeoutRef = useRef(null);
  const lastNavReadyRef = useRef(false);
  const lastTextHiddenRef = useRef(false);
  const [trailVisible, setTrailVisible] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    const trail = trailRef.current;
    const path = pathRef.current;
    const text = textRef.current;
    if (!section || !trail || !path || !text) return undefined;

    const texts = CAPSULE_SCROLL_TEXTS;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const measurePath = () => {
      const length = path.getTotalLength();
      pathLengthRef.current = length > 0 ? length : FALLBACK_PATH_LENGTH;
      path.style.strokeDasharray = `${pathLengthRef.current}`;
      path.style.strokeDashoffset = `${pathLengthRef.current}`;
    };

    const changeText = (newText) => {
      if (changeTimeoutRef.current) {
        clearTimeout(changeTimeoutRef.current);
      }

      isAnimatingRef.current = true;
      text.style.filter = `blur(${TEXT_EXIT_BLUR_PX}px)`;
      text.style.opacity = `${TEXT_EXIT_OPACITY}`;
      text.style.transform = 'scale(0.99)';

      changeTimeoutRef.current = setTimeout(() => {
        text.innerHTML = newText;
        text.style.filter = 'blur(0px)';
        text.style.opacity = '1';
        text.style.transform = `scale(${1 + progressRef.current * 0.02})`;
        isAnimatingRef.current = false;
        changeTimeoutRef.current = null;
      }, TEXT_SWAP_DELAY_MS);
    };

    const update = () => {
      const rect = section.getBoundingClientRect();
      const total = section.offsetHeight - window.innerHeight;
      const progress = total > 0 ? Math.min(Math.max(-rect.top / total, 0), 1) : 0;

      progressRef.current = progress;

      const sequenceComplete = progress >= 0.98;

      if (sequenceComplete !== lastTextHiddenRef.current) {
        if (sequenceComplete && changeTimeoutRef.current) {
          clearTimeout(changeTimeoutRef.current);
          changeTimeoutRef.current = null;
          isAnimatingRef.current = false;
        }

        lastTextHiddenRef.current = sequenceComplete;
        text.classList.toggle('is-complete-hidden', sequenceComplete);

        if (!sequenceComplete) {
          text.style.filter = 'blur(0px)';
          text.style.opacity = '1';
          text.style.transform = `scale(${1 + progress * 0.02})`;
        }
      }

      const isInside = rect.top <= 0 && rect.bottom >= window.innerHeight;
      const showTrail = isInside && !sequenceComplete;

      if (showTrail !== lastVisibleRef.current) {
        lastVisibleRef.current = showTrail;
        setTrailVisible(showTrail);
      }

      if (!sequenceComplete) {
        const index = Math.min(Math.floor(progress * texts.length), texts.length - 1);

        if (index !== lastIndexRef.current) {
          lastIndexRef.current = index;
          changeText(slideToHtml(texts[index]));
        } else if (!isAnimatingRef.current) {
          text.style.transform = `scale(${1 + progress * 0.02})`;
        }
      }

      path.style.strokeDashoffset = `${pathLengthRef.current - progress * pathLengthRef.current}`;

      const navReady = sequenceComplete;
      if (onCapsuleNavReady && navReady !== lastNavReadyRef.current) {
        lastNavReadyRef.current = navReady;
        onCapsuleNavReady(navReady);
      }
    };

    if (prefersReducedMotion) {
      pathLengthRef.current = path.getTotalLength() || FALLBACK_PATH_LENGTH;
      path.style.strokeDasharray = 'none';
      path.style.strokeDashoffset = '0';
      text.innerHTML = slideToHtml(texts[0]);
      text.style.opacity = '1';
      text.style.filter = 'none';
      text.classList.add('is-complete-hidden');
      lastVisibleRef.current = true;
      setTrailVisible(true);
      lastNavReadyRef.current = true;
      onCapsuleNavReady?.(true);
      return undefined;
    }

    text.innerHTML = slideToHtml(texts[0]);
    text.style.opacity = '1';
    text.style.filter = 'blur(0px)';

    requestAnimationFrame(() => {
      measurePath();
      update();
    });

    window.addEventListener('scroll', update, { passive: true });

    const handleResize = () => {
      measurePath();
      update();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', handleResize);
      if (changeTimeoutRef.current) {
        clearTimeout(changeTimeoutRef.current);
      }
    };
  }, [onCapsuleNavReady]);

  return (
    <section
      className="capsule-effect"
      ref={sectionRef}
      aria-labelledby="scrollText"
      style={{ '--capsule-scroll-height': `${CAPSULE_SCROLL_HEIGHT_VH}vh` }}
    >
      <svg
        ref={trailRef}
        className={`scroll-trail${trailVisible ? ' is-visible' : ''}`}
        viewBox="0 0 1440 800"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path ref={pathRef} id="trailPath" d={TRAIL_PATH} />
      </svg>

      <h1 id="scrollText" ref={textRef} />
    </section>
  );
}
