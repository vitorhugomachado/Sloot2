export const DEFAULT_LANDING_BILLING = 'annual';

export const LANDING_BILLING_OPTIONS = [
  { id: 'annual', label: 'Anual' },
  { id: 'monthly', label: 'Mensal' },
];

export const LANDING_PLANS = [
  {
    id: 'basico',
    tag: 'Essencial',
    image: '/landing/features/feature-agenda.png',
    imageAlt: 'Plano essencial Slooti',
    name: 'Básico',
    pricing: {
      monthly: 97,
      annualInstallment: 79,
    },
    description: 'Para barbearias começando a digitalizar a agenda.',
    highlights: ['Agenda online 24h', 'Até 2 barbeiros', 'Lembretes automáticos'],
    cta: { label: 'Começar teste grátis', href: null },
    featured: false,
  },
  {
    id: 'profissional',
    tag: 'Mais popular',
    image: '/landing/features/feature-equipe.png',
    imageAlt: 'Plano profissional Slooti',
    name: 'Profissional',
    pricing: {
      monthly: 197,
      annualInstallment: 159,
    },
    description: 'Gestão completa para equipes que querem crescer com controle.',
    highlights: ['Barbeiros ilimitados', 'Comissões automáticas', 'Financeiro integrado'],
    cta: { label: 'Escolher Profissional', href: null },
    featured: true,
  },
  {
    id: 'rede',
    tag: 'Multi-unidades',
    image: '/landing/features/feature-financeiro.png',
    imageAlt: 'Plano multi-unidades Slooti',
    name: 'Rede',
    pricing: null,
    description: 'Para redes e franquias com visão centralizada de todas as unidades.',
    highlights: ['Dashboard multi-loja', 'Relatórios consolidados', 'Suporte prioritário'],
    cta: { label: 'Falar com vendas', href: '#contato' },
    featured: false,
  },
];

export function formatPlanPrice(value) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function getPlanPriceDisplay(plan, billing) {
  if (!plan.pricing) {
    return { main: 'Sob consulta', suffix: '' };
  }

  if (billing === 'annual') {
    return {
      main: `12x ${formatPlanPrice(plan.pricing.annualInstallment)}`,
      suffix: '/mês',
      note: `${formatPlanPrice(plan.pricing.annualInstallment * 12)} por ano`,
    };
  }

  return {
    main: formatPlanPrice(plan.pricing.monthly),
    suffix: '/mês',
    note: '',
  };
}
