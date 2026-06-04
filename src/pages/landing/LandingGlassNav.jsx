import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DEFAULT_SLUG } from '../../context/TenantContext';
import { tenantBookingPath } from '../../constants/tenantRoutes';
import { LANDING_DEMO_PATH } from './landingFinalCta.config';
import './landing-glass-nav.css';

const DEMO_BOOKING = tenantBookingPath(DEFAULT_SLUG);

const NAV_LINKS = [
  { href: '#recursos', label: 'Recursos' },
  { href: '#plataforma', label: 'Como funciona' },
  { href: '#planos', label: 'Planos' },
  { href: '#depoimentos', label: 'Depoimentos' },
];

export default function LandingGlassNav({ visible = false }) {
  const [open, setOpen] = useState(false);

  const closeMenu = () => setOpen(false);

  useEffect(() => {
    if (!visible) {
      setOpen(false);
    }
  }, [visible]);

  return (
    <header className={`landing-glass-nav${visible ? ' is-visible' : ''}`}>
      <div className={`landing-glass-nav__bar${open ? ' is-open' : ''}`}>
        <Link to="/" className="landing-glass-nav__logo" aria-label="Slooti — início" onClick={closeMenu}>
          <img src="/landing/slooti-mark.png" alt="" className="landing-glass-nav__logo-img" />
        </Link>

        <nav className="landing-glass-nav__nav" aria-label="Principal">
          <ul className="landing-glass-nav__links">
            {NAV_LINKS.map(({ href, label }) => (
              <li key={href}>
                <a href={href} className="landing-glass-nav__link" onClick={closeMenu}>
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="landing-glass-nav__actions">
          <Link
            to={LANDING_DEMO_PATH}
            className="landing-glass-nav__demo"
            onClick={closeMenu}
          >
            Ver demo
          </Link>
          <Link to={DEMO_BOOKING} className="landing-glass-nav__cta" onClick={closeMenu}>
            Teste grátis
          </Link>

          <button
            type="button"
            className="landing-glass-nav__toggle"
            aria-expanded={open}
            aria-controls="landing-glass-nav-menu"
            aria-label={open ? 'Fechar menu' : 'Abrir menu'}
            onClick={() => setOpen((value) => !value)}
          >
            <span />
            <span />
          </button>
        </div>

        <div
          id="landing-glass-nav-menu"
          className={`landing-glass-nav__mobile${open ? ' is-visible' : ''}`}
        >
          <ul className="landing-glass-nav__mobile-list">
            {NAV_LINKS.map(({ href, label }) => (
              <li key={href}>
                <a href={href} className="landing-glass-nav__mobile-link" onClick={closeMenu}>
                  {label}
                </a>
              </li>
            ))}
            <li>
              <Link
                to={LANDING_DEMO_PATH}
                className="landing-glass-nav__mobile-link"
                onClick={closeMenu}
              >
                Ver demo
              </Link>
            </li>
            <li>
              <Link to={DEMO_BOOKING} className="landing-glass-nav__mobile-cta" onClick={closeMenu}>
                Teste grátis
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </header>
  );
}
