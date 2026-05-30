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
} from 'lucide-react';
import SlootiLogo from '../../components/SlootiLogo';
import { DEFAULT_SLUG } from '../../context/TenantContext';
import { tenantBookingPath, tenantLoginPath } from '../../constants/tenantRoutes';
import Reveal from './Reveal';
import LandingPricing from './LandingPricing';
import './landing.css';

const DEMO_SLUG = DEFAULT_SLUG;
const DEMO_BOOKING = tenantBookingPath(DEMO_SLUG);
const DEMO_LOGIN = tenantLoginPath(DEMO_SLUG);

const USE_CASES = [
  'Agendamentos online',
  'Gestão de equipe',
  'Controle financeiro',
  'Estoque',
  'Portal do cliente',
  'Relatórios',
];

const FEATURES = [
  {
    icon: Calendar,
    title: 'Agenda inteligente',
    text: 'Horários, bloqueios e confirmações automáticas. Seus clientes agendam 24h pelo link da barbearia.',
  },
  {
    icon: Users,
    title: 'Equipe organizada',
    text: 'Comissões, metas e permissões por barbeiro. Cada profissional com sua agenda e visão do dia.',
  },
  {
    icon: Wallet,
    title: 'Financeiro claro',
    text: 'Receitas, despesas e fechamento mensal em um só lugar. Saiba exatamente quanto a barbearia lucrou.',
  },
  {
    icon: Package,
    title: 'Estoque sob controle',
    text: 'Produtos, vendas e alertas de reposição. Nunca mais perca venda por falta de item na prateleira.',
  },
  {
    icon: Smartphone,
    title: 'Experiência do cliente',
    text: 'Link de agendamento com a cara da sua marca. Login, histórico e reagendamento sem fricção.',
  },
  {
    icon: BarChart3,
    title: 'Painel em tempo real',
    text: 'KPIs, ocupação e próximos atendimentos. Decisões rápidas com dados que fazem sentido.',
  },
];

const STEPS = [
  {
    num: '01',
    title: 'Configure sua barbearia',
    text: 'Serviços, horários, equipe e identidade visual. Tudo pronto em minutos, sem planilhas.',
  },
  {
    num: '02',
    title: 'Compartilhe o link',
    text: 'Clientes agendam pelo celular. Você recebe notificações e gerencia tudo pelo painel.',
  },
  {
    num: '03',
    title: 'Escale com confiança',
    text: 'Mais barbeiros, mais unidades, mais controle. A Slooti cresce junto com o seu negócio.',
  },
];

const STATS = [
  { value: '3×', label: 'Mais agendamentos com link online' },
  { value: '40%', label: 'Menos tempo em tarefas administrativas' },
  { value: '24/7', label: 'Agenda aberta para seus clientes' },
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

const TRUST_NAMES = [
  'Barbearias independentes',
  'Redes regionais',
  'Studios masculinos',
  'Salões híbridos',
  'Franquias locais',
  'Barbeiros autônomos',
];

function UseCaseRotator() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setActive((prev) => (prev + 1) % USE_CASES.length);
    }, 2400);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="landing-rotator" aria-hidden>
      {USE_CASES.map((label, i) => (
        <span
          key={label}
          className={`landing-rotator__pill ${i === active ? 'landing-rotator__pill--active' : ''}`}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function DashboardMock() {
  return (
    <div className="landing-mock">
      <div className="landing-mock__bar">
        <span className="landing-mock__dot" />
        <span className="landing-mock__dot" />
        <span className="landing-mock__dot" />
      </div>
      <div className="landing-mock__screen">
        <div className="landing-mock__kpi-row">
          <div className="landing-mock__kpi">
            <div className="landing-mock__kpi-label">Receita do mês</div>
            <div className="landing-mock__kpi-value">R$ 18.420</div>
          </div>
          <div className="landing-mock__kpi">
            <div className="landing-mock__kpi-label">Ocupação</div>
            <div className="landing-mock__kpi-value">87%</div>
          </div>
        </div>
        <div className="landing-mock__bars">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="landing-mock__bar-col" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [navScrolled, setNavScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="landing-page">
      <div className="landing-banner">
        <span>
          Plataforma completa para barbearias — <strong>agenda, equipe e financeiro</strong> em um só lugar.
        </span>
        <a className="landing-banner__link" href="#contato">
          Falar com vendas →
        </a>
      </div>

      <header className={`landing-nav ${navScrolled ? 'landing-nav--scrolled' : ''}`}>
        <Link to="/" aria-label="Slooti — início">
          <SlootiLogo size="md" onDark />
        </Link>

        <nav className="landing-nav__links" aria-label="Principal">
          <a href="#recursos">Recursos</a>
          <a href="#planos">Planos</a>
          <a href="#como-funciona">Como funciona</a>
          <a href="#depoimentos">Depoimentos</a>
        </nav>

        <div className="landing-nav__actions">
          <Link to={DEMO_LOGIN} className="landing-btn landing-btn--ghost">
            Entrar
          </Link>
          <a href="#planos" className="landing-btn landing-btn--primary">
            Ver planos
          </a>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero__glow landing-hero__glow--1" aria-hidden />
        <div className="landing-hero__glow landing-hero__glow--2" aria-hidden />
        <div className="landing-hero__grid" aria-hidden />

        <div className="landing-hero__content">
          <span className="landing-hero__eyebrow">Software para barbearias</span>
          <h1 className="landing-hero__title">
            Gestão completa para sua <em>barbearia</em>
          </h1>
          <p className="landing-hero__subtitle">
            Agenda online, equipe, estoque e financeiro — tudo no mesmo sistema.
            Profissionalize sua operação sem complicação.
          </p>
          <div className="landing-hero__cta">
            <a href="#planos" className="landing-btn landing-btn--primary">
              Escolher plano
              <ArrowRight size={18} aria-hidden />
            </a>
            <Link to={DEMO_BOOKING} className="landing-btn landing-btn--ghost">
              Ver demo ao vivo
            </Link>
          </div>
        </div>

        <figure className="landing-hero__quote">
          <p>
            &ldquo;Finalmente um sistema que a equipe usa de verdade — simples para o cliente,
            poderoso para quem gerencia.&rdquo;
          </p>
          <cite>
            <strong>Dono de barbearia</strong>
            Cliente Slooti
          </cite>
        </figure>
      </section>

      <section className="landing-trust" aria-label="Confiança">
        <p className="landing-trust__label">Feito para quem vive de barbearia</p>
        <div className="landing-marquee">
          <div className="landing-marquee__track">
            {[...TRUST_NAMES, ...TRUST_NAMES].map((name, i) => (
              <span key={`${name}-${i}`} className="landing-marquee__item">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section id="recursos" className="landing-section">
        <div className="landing-section__inner">
          <Reveal>
            <span className="landing-section__eyebrow">Recursos</span>
            <h2 className="landing-section__title">
              Um sistema para tudo que importa na sua barbearia
            </h2>
            <p className="landing-section__desc">
              Pare de juntar ferramentas soltas. A Slooti centraliza operação, clientes e números
              para você focar no que faz melhor: cortar cabelo.
            </p>
          </Reveal>

          <UseCaseRotator />

          <div className="landing-cards">
            {FEATURES.map((feature, i) => (
              <Reveal key={feature.title} delay={i * 80}>
                <article className="landing-card">
                  <div className="landing-card__icon">
                    <feature.icon size={22} aria-hidden />
                  </div>
                  <h3 className="landing-card__title">{feature.title}</h3>
                  <p className="landing-card__text">{feature.text}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--light">
        <div className="landing-section__inner landing-split">
          <Reveal>
            <span className="landing-section__eyebrow">Painel da equipe</span>
            <h2 className="landing-section__title">
              Self-serve para sua operação. Sem caos.
            </h2>
            <p className="landing-section__desc">
              Ferramentas gratuitas espalham dados e desorganizam a marca. A Slooti dá um sistema
              único para barbeiros, recepção e donos — todos na mesma página, literalmente.
            </p>
            <Link to={DEMO_LOGIN} className="landing-btn landing-btn--primary">
              Conhecer o painel
              <ArrowRight size={18} aria-hidden />
            </Link>
          </Reveal>

          <Reveal delay={120}>
            <DashboardMock />
          </Reveal>
        </div>
      </section>

      <LandingPricing />

      <section id="como-funciona" className="landing-section">
        <div className="landing-section__inner">
          <Reveal>
            <span className="landing-section__eyebrow">Como funciona</span>
            <h2 className="landing-section__title">
              Sua parceira para profissionalizar a barbearia
            </h2>
            <p className="landing-section__desc">
              Não entregamos só software. A Slooti acompanha você do primeiro cadastro até escalar
              com múltiplos profissionais.
            </p>
          </Reveal>

          <div className="landing-steps">
            {STEPS.map((step, i) => (
              <Reveal key={step.num} delay={i * 100}>
                <article className="landing-step">
                  <span className="landing-step__num">{step.num}</span>
                  <h3 className="landing-step__title">{step.title}</h3>
                  <p className="landing-step__text">{step.text}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="depoimentos" className="landing-section landing-section--light">
        <div className="landing-section__inner">
          <Reveal>
            <span className="landing-section__eyebrow">Resultados</span>
            <h2 className="landing-section__title">
              Barbearias como a sua já estão no controle
            </h2>
          </Reveal>

          <div className="landing-stats">
            {STATS.map((stat, i) => (
              <Reveal key={stat.label} delay={i * 90}>
                <div className="landing-stat">
                  <span className="landing-stat__value">{stat.value}</span>
                  <span className="landing-stat__label">{stat.label}</span>
                </div>
              </Reveal>
            ))}
          </div>

          <div className="landing-testimonials">
            {TESTIMONIALS.map((item, i) => (
              <Reveal key={item.name} delay={i * 100}>
                <figure className="landing-testimonial">
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

      <section className="landing-section">
        <div className="landing-section__inner landing-split">
          <Reveal>
            <span className="landing-section__eyebrow">Agendamento online</span>
            <h2 className="landing-section__title">
              Link de agendamento com a cara da sua marca
            </h2>
            <p className="landing-section__desc">
              Seus clientes escolhem serviço, barbeiro e horário pelo celular — sem ligação,
              sem mensagem perdida. Você define cores, logo e regras de agenda.
            </p>
          </Reveal>

          <Reveal delay={120}>
            <div className="landing-mock">
              <div className="landing-mock__bar">
                <span className="landing-mock__dot" />
                <span className="landing-mock__dot" />
                <span className="landing-mock__dot" />
              </div>
              <div className="landing-mock__screen" style={{ minHeight: 220 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: 'rgba(255,106,0,0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ff6a00',
                    }}
                  >
                    <Scissors size={22} aria-hidden />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '1rem' }}>Sua Barbearia</div>
                    <div style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.5)' }}>
                      Agende em 3 passos
                    </div>
                  </div>
                </div>
                {['Corte + barba', 'Escolher barbeiro', 'Data e horário'].map((step, idx) => (
                  <div
                    key={step}
                    style={{
                      padding: '0.85rem 1rem',
                      marginBottom: '0.5rem',
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: idx === 0 ? 'rgba(255,106,0,0.12)' : 'rgba(255,255,255,0.03)',
                      fontSize: '0.9375rem',
                    }}
                  >
                    {step}
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="contato" className="landing-cta-band">
        <div className="landing-cta-band__glow" aria-hidden />
        <div className="landing-cta-band__inner">
          <Reveal>
            <h2 className="landing-cta-band__title">
              Pronto para levar sua barbearia ao próximo nível?
            </h2>
            <p className="landing-cta-band__desc">
              Agende uma demonstração gratuita e veja como a Slooti se adapta ao seu fluxo de trabalho.
            </p>
            <div className="landing-hero__cta">
              <a href="#planos" className="landing-btn landing-btn--primary">
                Ver planos e preços
              </a>
              <Link to={DEMO_BOOKING} className="landing-btn landing-btn--ghost">
                Explorar demo
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer__grid">
          <div className="landing-footer__brand">
            <SlootiLogo size="md" onDark />
            <p>
              Software completo para barbearias modernas. Agenda, equipe, estoque e financeiro em
              uma plataforma pensada para o dia a dia.
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
            <a href="mailto:contato@slooti.com.br">Contato</a>
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
