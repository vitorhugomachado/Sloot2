import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import SlootiLogo from '../../components/SlootiLogo';
import { DEFAULT_SLUG } from '../../context/TenantContext';
import { tenantBookingPath } from '../../constants/tenantRoutes';
import { gsap, SLOOTI_EASE } from './gsap';
import './landing-underlay-nav.css';

const DEMO_BOOKING = tenantBookingPath(DEFAULT_SLUG);

const MAIN_LINKS = [
  { href: '/', label: 'Início', end: true },
  { href: '#recursos', label: 'Recursos' },
  { href: '#plataforma', label: 'Como funciona' },
  { href: '#planos', label: 'Planos' },
  { href: '#depoimentos', label: 'Depoimentos' },
  { href: '#contato', label: 'Contato' },
];

const SOCIAL_LINKS = [
  { href: 'https://instagram.com', label: 'Instagram' },
  { href: 'https://linkedin.com', label: 'LinkedIn' },
];

const QUICK_LINKS = [
  { href: DEMO_BOOKING, label: 'Teste grátis ↗', external: false },
  { href: '#', label: 'Privacidade ↗' },
  { href: '#', label: 'Termos ↗' },
];

export default function UnderlayNav() {
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const overlayRef = useRef(null);
  const timelineRef = useRef(null);
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const closeMenu = useCallback(() => setOpen(false), []);

  const playOpen = useCallback(() => {
    const menu = menuRef.current;
    const overlay = overlayRef.current;
    if (!menu || !overlay) return;

    timelineRef.current?.kill();

    const dark = overlay.querySelector('.underlay-nav__dark');
    const revealL = menu.querySelectorAll('[data-reveal-l]');
    const revealS = menu.querySelectorAll('[data-reveal-s]');

    gsap.set(overlay, { visibility: 'visible', pointerEvents: 'auto' });
    gsap.set(menu, { visibility: 'visible', pointerEvents: 'auto' });

    timelineRef.current = gsap
      .timeline({ defaults: { ease: SLOOTI_EASE } })
      .fromTo(dark, { opacity: 0 }, { opacity: 1, duration: 0.45 }, 0)
      .fromTo(menu, { xPercent: 100 }, { xPercent: 0, duration: 0.55 }, 0.05)
      .fromTo(
        revealL,
        { x: 32, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.55, stagger: 0.06 },
        0.28,
      )
      .fromTo(
        revealS,
        { y: 16, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.45, stagger: 0.05 },
        0.4,
      );
  }, []);

  const playClose = useCallback(() => {
    const menu = menuRef.current;
    const overlay = overlayRef.current;
    if (!menu || !overlay) return;

    timelineRef.current?.kill();

    const dark = overlay.querySelector('.underlay-nav__dark');
    const revealL = menu.querySelectorAll('[data-reveal-l]');
    const revealS = menu.querySelectorAll('[data-reveal-s]');

    timelineRef.current = gsap
      .timeline({
        defaults: { ease: SLOOTI_EASE },
        onComplete: () => {
          gsap.set(overlay, { visibility: 'hidden', pointerEvents: 'none' });
          gsap.set(menu, { visibility: 'hidden', pointerEvents: 'none' });
        },
      })
      .to([...revealS, ...revealL], { opacity: 0, y: 10, duration: 0.2, stagger: 0.02 }, 0)
      .to(menu, { xPercent: 100, duration: 0.45 }, 0.05)
      .to(dark, { opacity: 0, duration: 0.35 }, 0.1);
  }, []);

  useEffect(() => {
    const menu = menuRef.current;
    const overlay = overlayRef.current;
    if (!menu || !overlay) return;

    gsap.set(menu, { xPercent: 100, visibility: 'hidden', pointerEvents: 'none' });
    gsap.set(overlay.querySelector('.underlay-nav__dark'), { opacity: 0 });
    gsap.set(overlay, { visibility: 'hidden', pointerEvents: 'none', x: 0 });

    // Limpa transforms de versões antigas (underlay que deslocava a página)
    gsap.set(['.landing-page', '.landing-page__main', '[data-underlay-nav-overlay]'], {
      clearProps: 'transform',
    });
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeMenu();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, closeMenu]);

  useEffect(() => {
    if (open) {
      playOpen();
      document.body.style.overflow = 'hidden';
    } else if (menuRef.current && overlayRef.current) {
      const menuVisible = gsap.getProperty(menuRef.current, 'visibility') === 'visible';
      if (menuVisible) playClose();
      document.body.style.overflow = '';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [open, playOpen, playClose]);

  useEffect(() => () => timelineRef.current?.kill(), []);

  const isActive = (href, end) => end && location.pathname === '/';

  return (
    <div ref={rootRef} className={`underlay-nav${open ? ' is-open' : ''}`} data-underlay-nav>
      <header className="underlay-nav__header">
        <div className="underlay-nav__bar">
          <div className="underlay-nav__container">
            <Link to="/" className="underlay-nav__logo" aria-label="Slooti — início" onClick={closeMenu}>
              <SlootiLogo size="md" onDark={open} className="underlay-nav__logo-wordmark" />
            </Link>
            <button
              type="button"
              data-underlay-nav-toggle
              aria-expanded={open}
              aria-controls="underlay-nav-menu"
              aria-label={open ? 'Fechar menu' : 'Abrir menu'}
              className="underlay-nav__toggle"
              onClick={() => setOpen((value) => !value)}
            >
              <span className="underlay-nav__toggle-text">
                <span className="underlay-nav__toggle-label">Menu</span>
                <span className="underlay-nav__toggle-label">Close</span>
              </span>
              <span className="underlay-nav__toggle-icon" aria-hidden>
                <span className="underlay-nav__toggle-bar" />
                <span className="underlay-nav__toggle-bar" />
              </span>
            </button>
          </div>
        </div>
      </header>

      <div
        ref={overlayRef}
        data-underlay-nav-overlay
        className="underlay-nav__overlay"
        aria-hidden={!open}
        onClick={closeMenu}
        role="presentation"
      >
        <div className="underlay-nav__dark" />
        <div className="underlay-nav__borders">
          <div className="underlay-nav__border-row">
            <div className="underlay-nav__border" />
            <div className="underlay-nav__corner" />
          </div>
          <div className="underlay-nav__border-row">
            <div className="underlay-nav__corner is--bottom" />
            <div className="underlay-nav__border" />
          </div>
        </div>
      </div>

      <nav
        id="underlay-nav-menu"
        ref={menuRef}
        data-underlay-nav-menu
        className="underlay-nav__menu"
        aria-hidden={!open}
      >
        <div className="underlay-nav__inner">
          <ul className="underlay-nav__list">
            {MAIN_LINKS.map(({ href, label, end }) => {
              const current = isActive(href, end);
              const className = `underlay-nav__link-large${current ? ' is-current' : ''}`;

              if (end) {
                return (
                  <li key={href} data-reveal-l>
                    <Link
                      to={href}
                      aria-current={current ? 'page' : undefined}
                      className={className}
                      onClick={closeMenu}
                    >
                      <span className="underlay-nav__link-label">{label}</span>
                    </Link>
                  </li>
                );
              }

              return (
                <li key={href} data-reveal-l>
                  <a href={href} className={className} onClick={closeMenu}>
                    <span className="underlay-nav__link-label">{label}</span>
                  </a>
                </li>
              );
            })}
          </ul>

          <div className="underlay-nav__bottom">
            <div className="underlay-nav__bottom-col">
              <div data-reveal-s>
                <span className="underlay-nav__link-small is--faded">Redes</span>
              </div>
              <ul className="underlay-nav__list is--small">
                {SOCIAL_LINKS.map(({ href, label }) => (
                  <li key={label} data-reveal-s>
                    <a href={href} className="underlay-nav__link-small" target="_blank" rel="noreferrer">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div className="underlay-nav__bottom-col">
              <div data-reveal-s>
                <span className="underlay-nav__link-small is--faded">Links rápidos</span>
              </div>
              <ul className="underlay-nav__list is--small">
                {QUICK_LINKS.map(({ href, label, external }) => (
                  <li key={label} data-reveal-s>
                    {external === false ? (
                      <Link to={href} className="underlay-nav__link-small" onClick={closeMenu}>
                        {label}
                      </Link>
                    ) : (
                      <a href={href} className="underlay-nav__link-small">
                        {label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <div className="underlay-nav__bottom-border" data-reveal-s />
          </div>
        </div>
      </nav>
    </div>
  );
}
