export const HERO_ROTATING_WORDS = ['modernas', 'organizadas', 'profissionais', 'digitais'];

export const NAV_LINKS = [
  { id: 'beneficios', label: 'Benefícios' },
  { id: 'como-funciona', label: 'Como funciona' },
  { id: 'planos', label: 'Planos' },
  { id: 'faq', label: 'FAQ' },
];

export const SCROLL_PHRASES = [
  'Menos bagunça no WhatsApp',
  'Mais horários preenchidos',
  'Mais profissionalismo',
  'Mais tempo para atender',
];

export const PAIN_SECTION = {
  title: 'Sua barbearia ainda depende só do WhatsApp?',
  text:
    'Mensagens perdidas, horários duplicados, clientes esquecidos e uma agenda que depende de você o tempo todo. A Slooti resolve isso com uma página simples onde o cliente agenda sozinho.',
};

export const BENEFITS = [
  {
    icon: 'calendar',
    title: 'Agenda online 24h',
    text: 'Seus clientes agendam a qualquer hora, sem depender da sua resposta no WhatsApp.',
  },
  {
    icon: 'link',
    title: 'Página própria da barbearia',
    text: 'Um link exclusivo com a identidade da sua barbearia, pronto para compartilhar.',
  },
  {
    icon: 'scissors',
    title: 'Cadastro de serviços',
    text: 'Defina cortes, barba, combos e valores com poucos cliques.',
  },
  {
    icon: 'user',
    title: 'Cadastro de profissionais',
    text: 'Cada barbeiro com agenda própria e horários personalizados.',
  },
  {
    icon: 'sparkles',
    title: 'Experiência moderna para o cliente',
    text: 'Fluxo simples, visual limpo e agendamento em poucos passos.',
  },
  {
    icon: 'clock',
    title: 'Controle simples dos horários',
    text: 'Visualize a agenda do dia e mantenha tudo organizado em um só lugar.',
  },
];

export const STEPS = [
  {
    step: '01',
    icon: 'setup',
    title: 'Configure sua barbearia',
    text: 'Cadastre serviços, profissionais e horários de funcionamento em minutos.',
  },
  {
    step: '02',
    icon: 'share',
    title: 'Compartilhe seu link',
    text: 'Envie no WhatsApp, Instagram ou coloque na bio. O cliente agenda sozinho.',
  },
  {
    step: '03',
    icon: 'calendar',
    title: 'Receba agendamentos',
    text: 'Horários confirmados, agenda organizada e menos mensagens para responder.',
  },
];

export const METRICS = [
  { value: 1200, suffix: '', label: 'agendamentos simulados', prefix: '+' },
  { value: 80, suffix: '', label: 'barbearias interessadas', prefix: '+' },
  { value: 24, suffix: 'h', label: 'agenda disponível', prefix: '' },
  { value: 3, suffix: ' min', label: 'para configurar', prefix: '' },
];

export const DEFAULT_BILLING = 'annual';

export const BILLING_OPTIONS = [
  { id: 'annual', label: 'Anual' },
  { id: 'monthly', label: 'Mensal' },
];

export const PLANS = [
  {
    id: 'solo',
    name: 'Plano Solo',
    pricing: {
      monthly: 59.9,
      annualInstallments: 12,
      annualInstallmentValue: 45.75,
      annualCash: 549,
    },
    description: 'Para barbearias com um barbeiro que querem agendar online sem complicação.',
    includes: [
      '1 barbeiro',
      'Agendamento online 24h',
      'Clientes ilimitados',
      'Link personalizado de agendamento',
      'Histórico de atendimentos',
      'Bloqueio de horários',
      'Painel administrativo',
    ],
    excludes: [
      'Mais de 1 barbeiro',
      'Controle de comissões',
      'Dashboard gerencial',
      'Relatórios financeiros',
      'Suporte prioritário',
    ],
    featured: false,
  },
  {
    id: 'equipe',
    name: 'Plano Equipe',
    pricing: {
      monthly: 99.9,
      annualInstallments: 12,
      annualInstallmentValue: 74.92,
      annualCash: 899,
    },
    description: 'Para barbearias com equipe que precisam de controle, comissões e visão do negócio.',
    includesLabel: 'Inclui tudo do plano Solo',
    includesLabelStyle: 'normal',
    includes: [
      'Até 3 barbeiros',
      'Agenda individual por barbeiro',
      'Clientes ilimitados',
      'Controle de comissões',
      'Dashboard gerencial',
      'Relatórios de faturamento',
      'Relatórios de serviços',
      'Histórico completo',
    ],
    excludes: [
      'Mais de 3 barbeiros',
      'Múltiplas unidades',
      'Ranking de barbeiros',
      'Relatórios avançados',
      'Suporte prioritário',
    ],
    featured: true,
    badge: 'Mais popular',
  },
  {
    id: 'premium',
    name: 'Premium',
    pricing: {
      monthly: 249.9,
      annualInstallments: 12,
      annualInstallmentValue: 199.92,
      annualCash: 2399,
      annualNoteFormat: 'year',
    },
    description: 'Para redes e barbearias com múltiplas filiais que precisam de visão completa do negócio.',
    includesLabel: 'Inclui tudo do Equipe',
    includesLabelStyle: 'normal',
    includes: [
      'Barbeiros ilimitados',
      'Filiais ilimitadas',
      'Usuários administrativos ilimitados',
      'Controle de estoque',
      'Controle financeiro completo',
      'Fluxo de caixa',
      'Ranking de barbeiros',
      'Relatórios avançados',
      'Exportação Excel/PDF',
      'Dashboard executivo',
      'Permissões por usuário',
      'Lista de clientes inativos',
      'Relatório de retenção de clientes',
      'Recuperação de clientes ausentes',
      'Suporte prioritário',
    ],
    featured: false,
  },
];

/** Ordem do carrossel mobile — Equipe primeiro. */
export const MOBILE_PLANS = ['equipe', 'solo', 'premium']
  .map((id) => PLANS.find((plan) => plan.id === id))
  .filter(Boolean);

export function formatPlanPrice(value, fractionDigits = 0) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export function getPlanPriceDisplay(plan, billing) {
  if (!plan.pricing) {
    return { type: 'consult' };
  }

  if (billing === 'annual') {
    if (plan.pricing.annualInstallmentValue != null && plan.pricing.annualCash != null) {
      const count = plan.pricing.annualInstallments ?? 12;
      return {
        type: 'priced',
        headline: `${count}x de ${formatPlanPrice(plan.pricing.annualInstallmentValue, 2)}`,
        note:
          plan.pricing.annualNoteFormat === 'year'
            ? `(${formatPlanPrice(plan.pricing.annualCash, 0)}/ano)`
            : `ou ${formatPlanPrice(plan.pricing.annualCash, 0)} à vista`,
      };
    }

    const monthly = plan.pricing.annualInstallment;
    const installment = monthly / 10;

    return {
      type: 'priced',
      headline: formatPlanPrice(monthly, 0),
      period: '/mês',
      pill: `ou 12x de ${formatPlanPrice(installment, 2)}`,
      note: `${formatPlanPrice(monthly * 12)} por ano`,
    };
  }

  return {
    type: 'priced',
    headline: formatPlanPrice(plan.pricing.monthly, 2),
    period: '/mês',
  };
}

export const FAQ_ITEMS = [
  {
    question: 'A Slooti substitui o WhatsApp?',
    answer:
      'Não substitui, mas reduz drasticamente o volume de mensagens. O cliente agenda pelo link e você usa o WhatsApp só quando faz sentido.',
  },
  {
    question: 'O cliente precisa baixar aplicativo?',
    answer:
      'Não. Tudo funciona no navegador do celular — basta abrir o link da sua barbearia.',
  },
  {
    question: 'Posso cadastrar mais de um barbeiro?',
    answer:
      'Sim. Cada profissional tem sua própria agenda e horários disponíveis.',
  },
  {
    question: 'Funciona no celular?',
    answer:
      'Sim. A experiência foi pensada mobile-first, para o cliente agendar em poucos toques.',
  },
  {
    question: 'Posso colocar o link no Instagram?',
    answer:
      'Com certeza. Coloque na bio, nos stories ou envie no direct — o link funciona em qualquer lugar.',
  },
];
