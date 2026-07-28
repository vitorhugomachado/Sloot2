import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Menu, X } from 'lucide-react';
import SlootiLogo from '../../components/SlootiLogo';
import { LANDING_WHATSAPP_URL } from '../landing-teste/landingContact.config';
import {
  CAPABILITIES,
  ETHOS,
  FINAL_CTA,
  FOOTER,
  HERO,
  MARQUEE,
  NAV,
  PROCESS,
  PRODUCTS,
  TEAM_SECTION,
  WORK,
} from './landing3.config';
import { scrollToId, useStellarMotion } from './useLanding3Effects';
import './landing3.css';

function whatsappUrl(message) {
  try {
    const url = new URL(LANDING_WHATSAPP_URL);
    url.searchParams.set('text', message);
    return url.toString();
  } catch {
    return LANDING_WHATSAPP_URL;
  }
}

const DEMO = whatsappUrl('Olá! Gostaria de solicitar uma demonstração do ecossistema SLOOTI.');
const CONTACT = whatsappUrl('Olá! Quero falar com a equipe SLOOTI.');

function WorkCard({ item }) {
  return (
    <article className={`st-work-card st-work-card--${item.tone}`}>
      <div className="st-work-card__art" aria-hidden>
        <span className="st-work-card__orb" />
        <div className="st-work-card__ui">
          <i /><i /><i />
          <b />
        </div>
      </div>
      <footer>
        <strong>{item.title}</strong>
        <span>{item.meta}</span>
      </footer>
    </article>
  );
}

function MarqueeCard({ item }) {
  return (
    <div className={`st-mq-card st-mq-card--${item.tone}`}>
      <div className="st-mq-card__meta">
        <em>{item.tag}</em>
        <strong>{item.title}</strong>
      </div>
      <div className="st-mq-card__visual" aria-hidden>
        <span /><span /><span />
      </div>
    </div>
  );
}

export default function Landing3Page() {
  const pageRef = useRef(null);
  const headerRef = useStellarMotion(pageRef);
  const [menuOpen, setMenuOpen] = useState(false);
  const [workFilter, setWorkFilter] = useState('Produtos');

  useEffect(() => {
    document.body.classList.add('st-lock');
    return () => document.body.classList.remove('st-lock');
  }, []);

  const go = (id) => {
    setMenuOpen(false);
    scrollToId(id);
  };

  const marqueeItems = [...MARQUEE, ...MARQUEE];

  return (
    <div className="st" ref={pageRef}>
      <a className="st-skip" href="#conteudo">Ir para o conteúdo</a>

      <header className="st-header" ref={headerRef}>
        <div className="st-header__inner">
          <a
            className="st-header__brand"
            href="#topo"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            <SlootiLogo size="md" onDark />
          </a>
          <nav className="st-header__nav" aria-label="Seções">
            {NAV.map((item) => (
              <button key={item.id} type="button" onClick={() => go(item.id)}>
                {item.label}
              </button>
            ))}
          </nav>
          <div className="st-header__actions">
            <a className="st-btn st-btn--accent" href={DEMO} target="_blank" rel="noreferrer">
              Solicitar demonstração
            </a>
            <button
              type="button"
              className="st-header__menu"
              aria-expanded={menuOpen}
              aria-controls="st-mobile"
              aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
        {menuOpen ? (
          <div className="st-mobile" id="st-mobile">
            {NAV.map((item) => (
              <button key={item.id} type="button" onClick={() => go(item.id)}>
                {item.label}
              </button>
            ))}
            <a className="st-btn st-btn--accent" href={DEMO} target="_blank" rel="noreferrer">
              Solicitar demonstração
            </a>
          </div>
        ) : null}
      </header>

      <main id="conteudo">
        <section className="st-hero" id="topo">
          <h1 data-hero-fade>{HERO.headline}</h1>
          <p data-hero-fade>{HERO.subheadline}</p>
        </section>

        <section className="st-marquee" aria-label="Recursos do ecossistema" data-reveal>
          <div className="st-marquee__viewport">
            <div className="st-marquee__track" data-marquee>
              {marqueeItems.map((item, i) => (
                <MarqueeCard key={`${item.title}-${i}`} item={item} />
              ))}
            </div>
          </div>
        </section>

        <section className="st-section st-team" id="ecossistema">
          <div className="st-wrap st-wrap--text" data-reveal>
            <h2>{TEAM_SECTION.title}</h2>
            <p>{TEAM_SECTION.text}</p>
          </div>
          <div className="st-cap-grid" data-reveal>
            {CAPABILITIES.map((cap) => (
              <article key={cap.name} className="st-cap" tabIndex={0}>
                <div className="st-cap__avatar" aria-hidden>
                  <span>{cap.name.slice(0, 1)}</span>
                </div>
                <h3>{cap.name}</h3>
                <p>{cap.role}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="st-section" id="produtos">
          <div className="st-products">
            {PRODUCTS.map((product) => (
              <article key={product.id} className="st-product" data-reveal>
                <p className="st-product__kicker">{product.kicker}</p>
                <h2>{product.name}</h2>
                <p className="st-product__desc">{product.description}</p>
                <ul>
                  {product.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <div className="st-product__footer">
                  <span className="st-product__price">{product.priceLabel}</span>
                  <a className="st-btn st-btn--accent" href={DEMO} target="_blank" rel="noreferrer">
                    {product.cta}
                    <ArrowRight size={16} aria-hidden />
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="st-section st-work" id="trabalho">
          <div className="st-wrap st-wrap--text" data-reveal>
            <h2>{WORK.title}</h2>
            <p>{WORK.text}</p>
            <div className="st-tabs" role="tablist" aria-label="Filtro">
              {WORK.filters.map((f) => (
                <button
                  key={f}
                  type="button"
                  role="tab"
                  aria-selected={workFilter === f}
                  className={workFilter === f ? 'is-active' : ''}
                  onClick={() => setWorkFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="st-work-grid" data-reveal>
            {WORK.items.map((item) => (
              <WorkCard key={item.title} item={item} />
            ))}
          </div>
        </section>

        <section className="st-section st-ethos" id="manifesto">
          <div className="st-wrap" data-reveal>
            <h2>{ETHOS.title}</h2>
            <p className="st-ethos__lead">{ETHOS.text}</p>
            <ul>
              {ETHOS.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <a className="st-btn st-btn--accent" href={DEMO} target="_blank" rel="noreferrer">
              {ETHOS.cta}
              <ArrowRight size={16} aria-hidden />
            </a>
          </div>
        </section>

        <section className="st-section" id="processo">
          <div className="st-wrap st-wrap--text" data-reveal>
            <h2>Como funciona</h2>
          </div>
          <ol className="st-steps" data-reveal>
            {PROCESS.map((step) => (
              <li key={step.n}>
                <span>{step.n}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="st-final" id="contato">
          <div data-reveal>
            <p className="st-final__eyebrow">{FINAL_CTA.price}</p>
            <h2>{FINAL_CTA.title}</h2>
            <a className="st-btn st-btn--accent st-btn--lg" href={DEMO} target="_blank" rel="noreferrer">
              {FINAL_CTA.button}
              <ArrowRight size={18} aria-hidden />
            </a>
          </div>
        </section>
      </main>

      <footer className="st-footer">
        <div className="st-footer__inner">
          <div>
            <SlootiLogo size="sm" onDark />
            <p>{FOOTER.blurb}</p>
          </div>
          <nav aria-label="Rodapé">
            {FOOTER.links.map((link) => (
              <button key={link.id} type="button" onClick={() => go(link.id)}>
                {link.label}
              </button>
            ))}
            <a href={CONTACT} target="_blank" rel="noreferrer">WhatsApp</a>
          </nav>
        </div>
        <p className="st-footer__copy">© {new Date().getFullYear()} SLOOTI</p>
      </footer>
    </div>
  );
}
