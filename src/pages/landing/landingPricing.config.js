export const DEFAULT_LANDING_BILLING = 'annual';

export const LANDING_BILLING_OPTIONS = [
  { id: 'annual', label: 'Anual' },
  { id: 'monthly', label: 'Mensal' },
];

export const LANDING_PLANS = [
  {
    id: 'basico',
    tag: 'Essencial',
    tagTone: 'accent',
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
    tagTone: 'accent',
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
    tagTone: 'neutral',
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

export function formatPlanPrice(value, fractionDigits = 0) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/** Valores exibidos como na referência visual dos cards (anual = R$/mês + pill 12x + total ano). */
export function getPlanPriceDisplay(plan, billing) {
  if (!plan.pricing) {
    return { type: 'consult' };
  }

  if (billing === 'annual') {
    const monthly = plan.pricing.annualInstallment;
    const installment = monthly / 10;

    return {
      type: 'priced',
      value: monthly,
      pill: `ou 12x de ${formatPlanPrice(installment, 2)}`,
      note: `${formatPlanPrice(monthly * 12)} por ano`,
    };
  }

  return {
    type: 'priced',
    value: plan.pricing.monthly,
    pill: null,
    note: null,
  };
}
