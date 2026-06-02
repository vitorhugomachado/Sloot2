import { useState } from 'react';
import { Link } from 'react-router-dom';
import SlootiLogo from '../../components/SlootiLogo';
import {
  FOOTER_COLUMNS,
  FOOTER_LEGAL,
  FOOTER_SOCIAL,
} from './landingFooter.config';
import './landing-footer.css';

function SocialIcon({ name }) {
  if (name === 'linkedin') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.119 20.452H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    );
  }

  if (name === 'instagram') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

export default function LandingFooter() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (event) => {
    event.preventDefault();
    if (!email.trim()) return;
    setSubscribed(true);
    setEmail('');
  };

  return (
    <footer id="contato" className="landing-footer" aria-label="Rodapé">
      <div className="landing-footer__inner">
        <div className="landing-footer__top">
          <Link to="/" className="landing-footer__brand" aria-label="Slooti — início">
            <SlootiLogo size="xl" onDark />
          </Link>

          <div className="landing-footer__newsletter">
            <h2 className="landing-footer__newsletter-title">Receba novidades</h2>
            {subscribed ? (
              <p className="landing-footer__newsletter-success" role="status">
                Obrigado! Você está inscrito na nossa newsletter.
              </p>
            ) : (
              <form className="landing-footer__form" onSubmit={handleSubscribe}>
                <label className="landing-footer__field">
                  <span className="landing-footer__sr-only">E-mail</span>
                  <input
                    type="email"
                    name="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Digite seu e-mail *"
                    required
                    autoComplete="email"
                    className="landing-footer__input"
                  />
                  <button type="submit" className="landing-footer__submit">
                    Inscrever
                  </button>
                </label>
              </form>
            )}
            <p className="landing-footer__newsletter-note">
              Ao se inscrever, você concorda com nossa{' '}
              <a href="#contato" className="landing-footer__inline-link">
                Política de Privacidade
              </a>
              .
            </p>
          </div>
        </div>

        <div className="landing-footer__columns">
          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title} className="landing-footer__column">
              <h3 className="landing-footer__column-title">{column.title}</h3>
              <ul className="landing-footer__links">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="landing-footer__link">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="landing-footer__lang">
          <label htmlFor="landing-footer-lang" className="landing-footer__lang-label">
            Idioma:
          </label>
          <select id="landing-footer-lang" className="landing-footer__lang-select" defaultValue="pt-BR">
            <option value="pt-BR">Português (Brasil)</option>
            <option value="en">English</option>
          </select>
        </div>

        <div className="landing-footer__bar">
          <p className="landing-footer__copyright">
            © {new Date().getFullYear()} Slooti. Todos os direitos reservados.
          </p>

          <nav className="landing-footer__legal" aria-label="Legal">
            <ul className="landing-footer__legal-list">
              {FOOTER_LEGAL.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="landing-footer__legal-link">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="landing-footer__social">
            {FOOTER_SOCIAL.map(({ href, label, icon }) => (
              <a
                key={label}
                href={href}
                className="landing-footer__social-link"
                aria-label={label}
                target="_blank"
                rel="noreferrer"
              >
                <SocialIcon name={icon} />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
