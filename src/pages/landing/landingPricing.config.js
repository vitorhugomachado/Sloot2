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
    image: '/landing/plans/plan-basico.png',
    imageAlt: 'Cliente confirmando agendamento no celular na barbearia — plano Básico',
    name: 'Básico',
    pricing: {
      monthly: 97,
      annualInstallment: 79,
    },
    description: 'Para barbearias começando a digitalizar a agenda.',
    highlights: ['Agenda online 24h', 'Até 2 barbeiros', 'Lembretes automáticos'],
    cta: { label: 'Escolher Básico' },
    featured: false,
  },
  {
    id: 'profissional',
    tag: 'Mais popular',
    tagTone: 'accent',
    image: '/landing/plans/plan-profissional.png',
    imageAlt: 'Vários barbeiros atendendo ao mesmo tempo — plano Profissional',
    name: 'Profissional',
    pricing: {
      monthly: 197,
      annualInstallment: 159,
    },
    description: 'Gestão completa para equipes que querem crescer com controle.',
    highlights: ['Barbeiros ilimitados', 'Comissões automáticas', 'Financeiro integrado'],
    cta: { label: 'Escolher Profissional' },
    featured: true,
  },
  {
    id: 'rede',
    tag: 'Multi-unidades',
    tagTone: 'neutral',
    image: '/landing/plans/plan-rede.png',
    imageAlt: 'Gestora analisando desempenho de várias unidades no monitor — plano Rede',
    name: 'Rede',
    pricing: {
      monthly: 297,
      annualInstallment: 249,
    },
    description: 'Para redes e franquias com visão centralizada de todas as unidades.',
    highlights: ['Dashboard multi-loja', 'Relatórios consolidados', 'Suporte prioritário'],
    cta: { label: 'Escolher Rede' },
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
