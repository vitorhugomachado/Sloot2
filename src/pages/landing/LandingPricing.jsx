import { useMemo, useState } from 'react';
import { Check, X, Users, Sparkles, Clock } from 'lucide-react';
import Reveal from './Reveal';

const SOCIAL_PROOF = {
  totalBarbershops: 240,
  popularPlanShare: 73,
};

const PLANS = [
  {
    id: 'essencial',
    name: 'Essencial',
    desc: 'Para barbeiro solo que quer sair do caderno.',
    monthly: 97,
    features: [
      '1 barbeiro',
      'Agenda online 24/7',
      'Dashboard básico',
      'Link de agendamento',
      'Notificações de horário',
      'Suporte por e-mail',
    ],
    missing: [
      { label: 'Financeiro', loss: 'Sem controle de comissões' },
      { label: 'Estoque', loss: 'Sem rastreio de produtos' },
      { label: 'Múltiplos barbeiros', loss: 'Não escala a equipe' },
    ],
    cta: 'Começar no básico',
    ctaVariant: 'dark',
  },
  {
    id: 'profissional',
    name: 'Profissional',
    desc: 'Tudo que uma barbearia em crescimento precisa — sem pagar por unidade.',
    monthly: 197,
    popular: true,
    valueBadge: 'Melhor custo-benefício',
    socialProof: `${SOCIAL_PROOF.popularPlanShare}% das barbearias escolhem este plano`,
    scarcity: 'Onboarding prioritário — vagas limitadas este mês',
    features: [
      'Até 5 barbeiros',
      'Agenda + clientes',
      'Financeiro completo',
      'Comissões automáticas',
      'Estoque e vendas',
      'Relatórios avançados',
      'Suporte prioritário',
    ],
    missing: [{ label: 'Multi-unidade', loss: 'Apenas 1 unidade' }],
    cta: 'Quero o mais escolhido',
    ctaVariant: 'primary',
  },
  {
    id: 'rede',
    name: 'Rede',
    desc: 'Para franquias e grupos que precisam de escala e marca própria.',
    monthly: 397,
    anchor: true,
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
    cta: 'Falar com especialista',
    ctaVariant: 'dark',
  },
];

const SETUP_VALUE = 497;

function formatPrice(value) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function dailyFromMonthly(monthly) {
  return monthly / 30;
}

export default function LandingPricing() {
  const [billing, setBilling] = useState('annual');

  const plans = useMemo(
    () =>
      PLANS.map((plan) => {
        const annualFull = plan.monthly * 12;
        const annualDiscounted = Math.round(annualFull * 0.8);
        const installment = Math.round(annualDiscounted / 12);
        const isAnnual = billing === 'annual';
        const displayMonthly = isAnnual ? installment : plan.monthly;
        const savings = isAnnual ? annualFull - annualDiscounted : 0;

        return {
          ...plan,
          price: displayMonthly,
          isAnnual,
          savings,
          daily: dailyFromMonthly(displayMonthly),
        };
      }),
    [billing],
  );

  const maxSavings = Math.max(...plans.map((p) => p.savings));

  return (
    <section id="planos" className="landing-section landing-section--light landing-section--pricing">
      <div className="landing-section__inner">
        <Reveal>
          <span className="landing-section__eyebrow">Planos</span>
          <h2 className="landing-section__title">
            Invista menos que um corte por dia e pare de perder clientes
          </h2>
          <p className="landing-section__desc">
            Mais de {SOCIAL_PROOF.totalBarbershops} barbearias já centralizaram agenda, equipe e
            financeiro no slooti — setup de {formatPrice(SETUP_VALUE)} incluso em todos os planos.
          </p>
        </Reveal>

        <Reveal delay={40}>
          <div className="landing-pricing__social-proof" aria-label="Prova social">
            <div className="landing-pricing__social-avatars" aria-hidden>
              {['JM', 'RC', 'LF', 'AS'].map((initials) => (
                <span key={initials} className="landing-pricing__social-avatar">
                  {initials}
                </span>
              ))}
            </div>
            <p className="landing-pricing__social-text">
              <Users size={16} aria-hidden />
              <strong>{SOCIAL_PROOF.popularPlanShare}%</strong> escolhem o Profissional no primeiro mês
            </p>
          </div>
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
            <p className="landing-pricing__toggle-note">
              {billing === 'annual' ? (
                <>
                  <Sparkles size={14} aria-hidden />
                  Você economiza até <strong>{formatPrice(maxSavings)}</strong> por ano — equivale a{' '}
                  <strong>2 meses grátis</strong>
                </>
              ) : (
                <>
                  No plano anual você deixa de economizar até{' '}
                  <strong>{formatPrice(maxSavings)}</strong> por ano
                </>
              )}
            </p>
          </div>
        </Reveal>

        <div className="landing-pricing__grid">
          {plans.map((plan, i) => (
            <Reveal key={plan.id} delay={i * 90}>
              <article
                className={`landing-pricing__card ${plan.popular ? 'landing-pricing__card--popular' : ''} ${plan.anchor ? 'landing-pricing__card--anchor' : ''}`}
              >
                {plan.popular && (
                  <span className="landing-pricing__popular">Mais popular</span>
                )}
                {plan.valueBadge && (
                  <span className="landing-pricing__value-badge">{plan.valueBadge}</span>
                )}

                <h3 className="landing-pricing__name">{plan.name}</h3>
                <p className="landing-pricing__desc">{plan.desc}</p>

                {plan.socialProof && (
                  <p className="landing-pricing__plan-social">{plan.socialProof}</p>
                )}

                <div className="landing-pricing__price-block">
                  <div className="landing-pricing__price-row">
                    {plan.isAnnual && (
                      <span className="landing-pricing__installments">12x</span>
                    )}
                    <span className="landing-pricing__price">{formatPrice(plan.price)}</span>
                    <span className="landing-pricing__period">/mês</span>
                  </div>
                  {plan.isAnnual && (
                    <p className="landing-pricing__billing-note">no plano anual · −20%</p>
                  )}
                  <p className="landing-pricing__daily">
                    Equivale a <strong>{formatPrice(plan.daily)}</strong>/dia
                  </p>
                </div>

                {plan.savings > 0 && (
                  <p className="landing-pricing__savings">
                    Você economiza {formatPrice(plan.savings)} vs. pagar mês a mês
                  </p>
                )}

                {plan.scarcity && billing === 'annual' && (
                  <p className="landing-pricing__scarcity">
                    <Clock size={14} aria-hidden />
                    {plan.scarcity}
                  </p>
                )}

                <ul className="landing-pricing__features">
                  {plan.features.map((f) => (
                    <li key={f}>
                      <Check size={16} aria-hidden />
                      {f}
                    </li>
                  ))}
                  {plan.missing.map(({ label, loss }) => (
                    <li key={label} className="landing-pricing__feature--off">
                      <X size={14} aria-hidden />
                      <span>
                        <span className="landing-pricing__feature-off-label">{label}</span>
                        <span className="landing-pricing__feature-loss">{loss}</span>
                      </span>
                    </li>
                  ))}
                </ul>

                <a
                  href={`mailto:contato@slooti.com.br?subject=Plano ${plan.name} Slooti&body=Olá! Tenho interesse no plano ${plan.name} (${billing === 'monthly' ? 'mensal' : 'anual'}).`}
                  className={`landing-btn landing-pricing__cta landing-btn--${plan.ctaVariant}`}
                >
                  {plan.cta}
                </a>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal delay={120}>
          <div className="landing-pricing__guarantee">
            <p>
              <strong>Setup grátis</strong> (valor {formatPrice(SETUP_VALUE)}) · Cancele quando quiser
              · Sem multa de fidelidade
            </p>
          </div>
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
