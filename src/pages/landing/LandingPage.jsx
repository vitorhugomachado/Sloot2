import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Users,
  Package,
  Wallet,
  Smartphone,
  BarChart3,
  Scissors,
  ArrowRight,
  Briefcase,
  UserCircle,
  MessageCircle,
  Bell,
  Link2,
  Star,
  Menu,
  X,
  Zap,
  Shield,
} from 'lucide-react';
import SlootiLogo from '../../components/SlootiLogo';
import { DEFAULT_SLUG } from '../../context/TenantContext';
import { tenantBookingPath, tenantLoginPath } from '../../constants/tenantRoutes';
import Reveal from './Reveal';
import LandingPricing from './LandingPricing';
import {
  ProductShowcase,
  FEATURE_TAB_SCREENS,
  PERSONA_SCREENS,
  BENTO_MODULES,
} from './LandingProductShowcase';
import './landing.css';

const DEMO_SLUG = DEFAULT_SLUG;
const DEMO_BOOKING = tenantBookingPath(DEMO_SLUG);
const DEMO_LOGIN = tenantLoginPath(DEMO_SLUG);

const HERO_PILLS = [
  { icon: Calendar, label: 'Agenda online' },
  { icon: MessageCircle, label: 'WhatsApp' },
  { icon: Wallet, label: 'Financeiro' },
  { icon: Link2, label: 'Link de agendamento' },
  { icon: BarChart3, label: 'Relatórios' },
];

const PERSONAS = [
  {
    id: 'owner',
    label: 'Para o dono',
    icon: Briefcase,
    title: 'Gestão completa do negócio',
    bullets: [
      'Agendamentos, remarcações e cancelamentos em tempo real',
      'Financeiro, comissões e estoque no mesmo painel',
      'Link de agendamento com a marca da sua barbearia',
    ],
  },
  {
    id: 'pro',
    label: 'Para o barbeiro',
    icon: UserCircle,
    title: 'Autonomia na agenda do dia',
    bullets: [
      'Controle da agenda e notificações em tempo real',
      'Lembretes para reduzir faltas e buracos na cadeira',
      'Comissões e desempenho visíveis sem planilha',
    ],
  },
  {
    id: 'client',
    label: 'Para o cliente',
    icon: Users,
    title: 'Agendar em poucos toques',
    bullets: [
      'Escolha serviço, barbeiro e horário pelo celular',
      'Histórico e reagendamento sem ligar na barbearia',
      'Experiência com cores e logo do seu estabelecimento',
    ],
  },
];

const PLATFORM_STATS = [
  { value: '50', suffix: 'mil+', label: 'Agendamentos realizados' },
  { value: '500', suffix: '+', label: 'Barbearias na base' },
  { value: '24', suffix: '/7', label: 'Agenda aberta online' },
];

const RATINGS = [
  { platform: 'Google', score: '4,9', reviews: '120+' },
  { platform: 'App Store', score: '4,8', reviews: '80+' },
  { platform: 'Play Store', score: '4,8', reviews: '95+' },
];

const FEATURE_TABS = [
  {
    id: 'agenda',
    label: 'Agenda',
    headline: 'Para economizar seu tempo',
    sub: 'Automatize o atendimento e deixe a agenda aberta para o cliente — menos celular, mais cadeira ocupada.',
    items: [
      { icon: MessageCircle, title: 'Confirmações', text: 'Lembretes automáticos reduzem faltas e horários vazios.' },
      { icon: Calendar, title: 'Agenda inteligente', text: 'Bloqueios, horários por barbeiro e visão do dia em um clique.' },
      { icon: Link2, title: 'Link próprio', text: 'Seu cliente agenda 24h com a identidade visual da barbearia.' },
      { icon: Bell, title: 'Notificações', text: 'Equipe e dono acompanham mudanças em tempo real.' },
    ],
  },
  {
    id: 'gestao',
    label: 'Gestão',
    headline: 'Para gerenciar sua barbearia',
    sub: 'Informações importantes de forma simples — sem precisar entender de tecnologia.',
    items: [
      { icon: Users, title: 'Equipe e permissões', text: 'Cada barbeiro com agenda e acesso do jeito certo.' },
      { icon: BarChart3, title: 'Relatórios', text: 'Veja ocupação, ticket médio e quem performa melhor.' },
      { icon: Package, title: 'Estoque', text: 'Alertas de reposição e vendas de produtos.' },
      { icon: Smartphone, title: 'Portal do cliente', text: 'Login, histórico e fidelização em um só lugar.' },
    ],
  },
  {
    id: 'financeiro',
    label: 'Financeiro',
    headline: 'Para organizar suas finanças',
    sub: 'Controle pagamentos, comissões e resultado com visibilidade do que entra e sai.',
    items: [
      { icon: Wallet, title: 'Fluxo de caixa', text: 'Receitas, despesas e fechamento mensal centralizados.' },
      { icon: BarChart3, title: 'Comissões', text: 'Cálculo automático por barbeiro e por serviço.' },
      { icon: Calendar, title: 'Previsão', text: 'Antecipe faturamento com base na agenda confirmada.' },
      { icon: Shield, title: 'Transparência', text: 'Dono e gestor com números confiáveis, sem planilhas.' },
    ],
  },
];

const SEGMENTS = [
  'Barbearia independente',
  'Barbeiro autônomo',
  'Rede de unidades',
  'Studio masculino',
  'Franquia local',
  'Salão híbrido',
  'Espaço premium',
  'Barbearia de bairro',
];

const TESTIMONIALS = [
  {
    quote: 'Antes era WhatsApp e caderno. Hoje qualquer barbeiro vê a agenda e o financeiro fecha sozinho.',
    name: 'Rafael M.',
    role: 'Dono, Barbearia Centro',
  },
  {
    quote: 'Meus clientes adoram agendar pelo link. Parece app próprio, mas é tudo Slooti por trás.',
    name: 'Lucas F.',
    role: 'Barbeiro autônomo',
  },
  {
    quote: 'Finalmente consigo enxergar comissão e estoque sem abrir cinco planilhas diferentes.',
    name: 'Marina S.',
    role: 'Gestora, rede com 3 unidades',
  },
];

export default function LandingPage() {
  const [navScrolled, setNavScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [persona, setPersona] = useState('owner');
  const [featureTab, setFeatureTab] = useState('agenda');

  const activePersona = PERSONAS.find((p) => p.id === persona) ?? PERSONAS[0];
  const activeFeatures = FEATURE_TABS.find((t) => t.id === featureTab) ?? FEATURE_TABS[0];

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  return (
    <div className="landing-page landing-page--gendo">
      <div className="landing-banner">
        <span>
          Software completo para barbearias — <strong>agenda, equipe e financeiro</strong> em um só lugar.
        </span>
        <a className="landing-banner__link" href="#planos">
          Ver planos →
        </a>
      </div>

      <header className={`landing-nav landing-nav--light ${navScrolled ? 'landing-nav--scrolled' : ''}`}>
        <Link to="/" aria-label="Slooti — início" onClick={() => setMenuOpen(false)}>
          <SlootiLogo size="md" onDark={false} />
        </Link>

        <nav className="landing-nav__links" aria-label="Principal">
          <a href="#recursos">Recursos</a>
          <a href="#plataforma">Plataforma</a>
          <a href="#planos">Planos</a>
          <a href="#depoimentos">Depoimentos</a>
        </nav>

        <div className="landing-nav__actions">
          <Link to={DEMO_LOGIN} className="landing-btn landing-btn--text">
            Acessar conta
          </Link>
          <Link to={DEMO_BOOKING} className="landing-btn landing-btn--primary">
            <Zap size={16} aria-hidden />
            Teste grátis
          </Link>
          <button
            type="button"
            className="landing-nav__menu-btn"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      {menuOpen && (
        <div className="landing-mobile-menu" role="dialog" aria-modal="true" aria-label="Menu">
          <a href="#recursos" onClick={() => setMenuOpen(false)}>Recursos</a>
          <a href="#plataforma" onClick={() => setMenuOpen(false)}>Plataforma</a>
          <a href="#planos" onClick={() => setMenuOpen(false)}>Planos</a>
          <a href="#depoimentos" onClick={() => setMenuOpen(false)}>Depoimentos</a>
          <Link to={DEMO_LOGIN} onClick={() => setMenuOpen(false)}>Acessar conta</Link>
          <Link to={DEMO_BOOKING} className="landing-btn landing-btn--primary" onClick={() => setMenuOpen(false)}>
            Teste grátis
          </Link>
        </div>
      )}

      <section className="landing-hero landing-hero--gendo landing-hero--studio">
        <div className="landing-hero__inner">
          <div className="landing-hero__studio-copy">
            <h1 className="landing-hero__title landing-hero__title--gendo">
              Gerencie agenda, clientes e financeiro em um só lugar
            </h1>
            <p className="landing-hero__subtitle landing-hero__subtitle--gendo">
              Reservas, comissões, estoque e link de agendamento. Plataforma completa, rápida e
              intuitiva — funciona em qualquer dispositivo.
            </p>
            <div className="landing-hero__cta">
              <Link to={DEMO_BOOKING} className="landing-btn landing-btn--primary landing-btn--lg">
                <Zap size={18} aria-hidden />
                Teste grátis
              </Link>
              <a href="#contato" className="landing-btn landing-btn--outline landing-btn--lg">
                Agendar demonstração
              </a>
            </div>
            <ul className="landing-hero__pills" aria-label="Funcionalidades">
              {HERO_PILLS.map(({ icon: Icon, label }) => (
                <li key={label}>
                  <Icon size={16} aria-hidden />
                  {label}
                </li>
              ))}
            </ul>
          </div>
          <div className="landing-hero__studio-product">
            <ProductShowcase screen="dashboard" variant="hero" />
          </div>
          <div className="landing-hero__studio-fade" aria-hidden />
        </div>
      </section>

      <section className="landing-personas" aria-label="Para quem é o Slooti">
        <div className="landing-section__inner">
          <div className="landing-personas__tabs" role="tablist">
            {PERSONAS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={persona === p.id}
                className={`landing-personas__tab ${persona === p.id ? 'landing-personas__tab--active' : ''}`}
                onClick={() => setPersona(p.id)}
              >
                <p.icon size={18} aria-hidden />
                {p.label}
              </button>
            ))}
          </div>
          <div className="landing-personas__panel" role="tabpanel">
            <Reveal key={persona}>
              <div className="landing-personas__content">
                <div>
                  <h2 className="landing-personas__title">{activePersona.title}</h2>
                  <ul className="landing-personas__list">
                    {activePersona.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                  <div className="landing-hero__cta landing-hero__cta--left">
                    <Link to={DEMO_BOOKING} className="landing-btn landing-btn--primary">
                      <Zap size={16} aria-hidden />
                      Teste grátis
                    </Link>
                    <a href="#contato" className="landing-btn landing-btn--outline">
                      Agendar demonstração
                    </a>
                  </div>
                </div>
                <div className="landing-personas__mock">
                  <ProductShowcase
                    screen={PERSONA_SCREENS[persona]}
                    variant={persona === 'client' ? 'phone' : 'default'}
                  />
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section id="plataforma" className="landing-platform landing-section--cream">
        <div className="landing-section__inner">
          <Reveal>
            <p className="landing-platform__tag">Seu tempo é o nosso negócio</p>
            <h2 className="landing-section__title landing-section__title--center">
              Conheça a plataforma
            </h2>
          </Reveal>
          <div className="landing-platform__stats">
            {PLATFORM_STATS.map((stat, i) => (
              <Reveal key={stat.label} delay={i * 80}>
                <div className="landing-platform__stat">
                  <span className="landing-platform__stat-value">
                    {stat.value}
                    <small>{stat.suffix}</small>
                  </span>
                  <span className="landing-platform__stat-label">{stat.label}</span>
                </div>
              </Reveal>
            ))}
          </div>
          <div className="landing-ratings">
            {RATINGS.map((r, i) => (
              <Reveal key={r.platform} delay={i * 60}>
                <div className="landing-rating">
                  <span className="landing-rating__platform">{r.platform}</span>
                  <span className="landing-rating__score">
                    <Star size={16} fill="currentColor" aria-hidden />
                    {r.score} / 5
                  </span>
                  <span className="landing-rating__reviews">{r.reviews} avaliações</span>
                </div>
              </Reveal>
            ))}
          </div>
          <div className="lp-bento" aria-label="Módulos da plataforma">
            {BENTO_MODULES.map((item, i) => (
              <Reveal key={item.id} delay={i * 60}>
                <div className={`lp-bento__item lp-bento__item--${item.span}`}>
                  <span className="lp-bento__label">
                    <item.icon size={18} aria-hidden />
                    {item.label}
                  </span>
                  <ProductShowcase
                    screen={item.screen}
                    variant={item.span === 'phone' ? 'phone' : 'bento'}
                  />
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="recursos" className="landing-features">
        <div className="landing-section__inner">
          <Reveal>
            <h2 className="landing-section__title landing-section__title--center">
              {activeFeatures.headline}
            </h2>
            <p className="landing-section__desc landing-section__desc--center">
              {activeFeatures.sub}
            </p>
          </Reveal>
          <div className="landing-features__tabs" role="tablist" aria-label="Categorias">
            {FEATURE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={featureTab === tab.id}
                className={`landing-features__tab ${featureTab === tab.id ? 'landing-features__tab--active' : ''}`}
                onClick={() => setFeatureTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <Reveal key={featureTab}>
            <div className="landing-features__showcase">
              <ProductShowcase screen={FEATURE_TAB_SCREENS[featureTab]} variant="hero" />
            </div>
          </Reveal>
          <div className="landing-features__grid" role="tabpanel">
            {activeFeatures.items.map((item, i) => (
              <Reveal key={item.title} delay={i * 70}>
                <article className="landing-feature-card">
                  <div className="landing-feature-card__icon">
                    <item.icon size={22} aria-hidden />
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-segments landing-section--cream">
        <div className="landing-section__inner">
          <Reveal>
            <h2 className="landing-section__title landing-section__title--center">
              Barbearias que crescem com a Slooti
            </h2>
            <p className="landing-section__desc landing-section__desc--center">
              Não precisa entender de tecnologia — é só deixar o sistema trabalhar por você.
            </p>
          </Reveal>
          <div className="landing-segments__chips">
            {SEGMENTS.map((name, i) => (
              <span key={name} className="landing-segments__chip" style={{ animationDelay: `${i * 40}ms` }}>
                <Scissors size={14} aria-hidden />
                {name}
              </span>
            ))}
          </div>
          <Reveal delay={120}>
            <div className="landing-app-showcase">
              <div>
                <h3 className="landing-app-showcase__title">
                  Link de agendamento com a cara da sua marca
                </h3>
                <p className="landing-app-showcase__text">
                  Personalize cores e logo. Seus clientes agendam online, fácil e rápido — você
                  acompanha tudo no painel da equipe.
                </p>
                <Link to={DEMO_BOOKING} className="landing-btn landing-btn--primary">
                  Ver demo ao vivo
                  <ArrowRight size={18} aria-hidden />
                </Link>
              </div>
              <ProductShowcase screen="booking" variant="phone" />
            </div>
          </Reveal>
        </div>
      </section>

      <LandingPricing />

      <section id="depoimentos" className="landing-testimonials-section">
        <div className="landing-section__inner">
          <Reveal>
            <span className="landing-section__eyebrow landing-section__eyebrow--center">Depoimentos</span>
            <h2 className="landing-section__title landing-section__title--center">
              Ser cada dia maior e melhor é para quem usa Slooti
            </h2>
          </Reveal>
          <div className="landing-testimonials landing-testimonials--gendo">
            {TESTIMONIALS.map((item, i) => (
              <Reveal key={item.name} delay={i * 100}>
                <figure className="landing-testimonial landing-testimonial--gendo">
                  <blockquote>&ldquo;{item.quote}&rdquo;</blockquote>
                  <footer>
                    <strong>{item.name}</strong>
                    {item.role}
                  </footer>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="contato" className="landing-cta-band landing-cta-band--gendo">
        <div className="landing-cta-band__inner">
          <Reveal>
            <h2 className="landing-cta-band__title">
              Pronto para profissionalizar sua barbearia?
            </h2>
            <p className="landing-cta-band__desc">
              Teste grátis ou fale com nosso time — mostramos a plataforma no seu ritmo.
            </p>
            <div className="landing-hero__cta">
              <Link to={DEMO_BOOKING} className="landing-btn landing-btn--primary landing-btn--lg">
                <Zap size={18} aria-hidden />
                Começar teste grátis
              </Link>
              <a
                href="mailto:contato@slooti.com.br?subject=Demonstração Slooti"
                className="landing-btn landing-btn--outline landing-btn--lg landing-btn--on-dark"
              >
                Falar com vendas
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="landing-footer landing-footer--light">
        <div className="landing-footer__grid">
          <div className="landing-footer__brand">
            <SlootiLogo size="md" onDark={false} />
            <p>
              Software completo para barbearias. Agenda, equipe, estoque e financeiro em uma
              plataforma pensada para o dia a dia.
            </p>
          </div>
          <div className="landing-footer__col">
            <h4>Produto</h4>
            <a href="#recursos">Recursos</a>
            <a href="#planos">Planos</a>
            <Link to={DEMO_BOOKING}>Demo ao vivo</Link>
            <Link to={DEMO_LOGIN}>Login equipe</Link>
          </div>
          <div className="landing-footer__col">
            <h4>Empresa</h4>
            <a href="mailto:contato@slooti.com.br">contato@slooti.com.br</a>
            <a href="#depoimentos">Clientes</a>
          </div>
          <div className="landing-footer__col">
            <h4>Legal</h4>
            <a href="/">Termos de uso</a>
            <a href="/">Privacidade</a>
          </div>
        </div>
        <div className="landing-footer__bottom">
          <span>© {new Date().getFullYear()} Slooti. Todos os direitos reservados.</span>
          <span>slooti.com.br</span>
        </div>
      </footer>
    </div>
  );
}
