import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import Reveal from './Reveal';

const PLANS = [
  {
    id: 'essencial',
    name: 'Essencial',
    desc: 'Para barbeiro solo ou operação enxuta.',
    monthly: 97,
    features: [
      '1 barbeiro',
      'Agenda online 24/7',
      'Dashboard básico',
      'Link de agendamento',
      'Notificações de horário',
      'Suporte por e-mail',
    ],
    missing: ['Financeiro', 'Estoque', 'Múltiplos barbeiros'],
  },
  {
    id: 'profissional',
    name: 'Profissional',
    desc: 'O mais escolhido por barbearias em crescimento.',
    monthly: 197,
    popular: true,
    features: [
      'Até 5 barbeiros',
      'Agenda + clientes',
      'Financeiro completo',
      'Comissões automáticas',
      'Estoque e vendas',
      'Relatórios avançados',
      'Suporte prioritário',
    ],
    missing: ['Multi-unidade'],
  },
  {
    id: 'rede',
    name: 'Rede',
    desc: 'Para franquias e grupos com várias unidades.',
    monthly: 397,
    features: [
      'Barbeiros ilimitados',
      'Todas as funcionalidades',
      'Multi-unidade',
      'Onboarding dedicado',
      'Personalização de marca',
      'API e integrações',
      'Gerente de sucesso',
    ],
    missing: [],
  },
];

function formatPrice(value) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

export default function LandingPricing() {
  const [billing, setBilling] = useState('monthly');

  const plans = useMemo(
    () =>
      PLANS.map((plan) => ({
        ...plan,
        price: billing === 'monthly' ? plan.monthly : Math.round(plan.monthly * 12 * 0.8),
        period: billing === 'monthly' ? '/mês' : '/ano',
        savings: billing === 'annual' ? Math.round(plan.monthly * 12 * 0.2) : 0,
      })),
    [billing],
  );

  return (
    <section id="planos" className="landing-section landing-section--light landing-section--pricing">
      <div className="landing-section__inner">
        <Reveal>
          <span className="landing-section__eyebrow">Planos</span>
          <h2 className="landing-section__title">
            Escolha o plano ideal para sua barbearia
          </h2>
          <p className="landing-section__desc">
            Comece pequeno e evolua quando precisar. Todos os planos incluem agendamento online
            e painel da equipe — sem taxa de setup.
          </p>
        </Reveal>

        <Reveal delay={60}>
          <div className="landing-pricing__toggle-wrap">
            <div className="landing-pricing__toggle" role="group" aria-label="Periodicidade">
              <button
                type="button"
                className={`landing-pricing__toggle-btn ${billing === 'monthly' ? 'landing-pricing__toggle-btn--active' : ''}`}
                onClick={() => setBilling('monthly')}
                aria-pressed={billing === 'monthly'}
              >
                Mensal
              </button>
              <button
                type="button"
                className={`landing-pricing__toggle-btn ${billing === 'annual' ? 'landing-pricing__toggle-btn--active' : ''}`}
                onClick={() => setBilling('annual')}
                aria-pressed={billing === 'annual'}
              >
                Anual
                <span className="landing-pricing__badge">−20%</span>
              </button>
            </div>
            {billing === 'annual' && (
              <p className="landing-pricing__toggle-note">Economize 2 meses pagando anualmente.</p>
            )}
          </div>
        </Reveal>

        <div className="landing-pricing__grid">
          {plans.map((plan, i) => (
            <Reveal key={plan.id} delay={i * 90}>
              <article
                className={`landing-pricing__card ${plan.popular ? 'landing-pricing__card--popular' : ''}`}
              >
                {plan.popular && <span className="landing-pricing__popular">Mais popular</span>}
                <h3 className="landing-pricing__name">{plan.name}</h3>
                <p className="landing-pricing__desc">{plan.desc}</p>
                <div className="landing-pricing__price-row">
                  <span className="landing-pricing__price">{formatPrice(plan.price)}</span>
                  <span className="landing-pricing__period">{plan.period}</span>
                </div>
                {plan.savings > 0 && (
                  <p className="landing-pricing__savings">
                    Economia de {formatPrice(plan.savings)} por ano
                  </p>
                )}
                <ul className="landing-pricing__features">
                  {plan.features.map((f) => (
                    <li key={f}>
                      <Check size={16} aria-hidden />
                      {f}
                    </li>
                  ))}
                  {plan.missing.map((f) => (
                    <li key={f} className="landing-pricing__feature--off">
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href={`mailto:contato@slooti.com.br?subject=Plano ${plan.name} Slooti&body=Olá! Tenho interesse no plano ${plan.name} (${billing === 'monthly' ? 'mensal' : 'anual'}).`}
                  className={`landing-btn landing-pricing__cta ${plan.popular ? 'landing-btn--primary' : 'landing-btn--dark'}`}
                >
                  Escolher {plan.name}
                </a>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal delay={120}>
          <p className="landing-pricing__footnote">
            Precisa de algo customizado?{' '}
            <a href="mailto:contato@slooti.com.br?subject=Plano personalizado Slooti">
              Fale conosco
            </a>{' '}
            para redes com 10+ unidades ou integrações especiais.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
