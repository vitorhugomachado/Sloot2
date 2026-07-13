export const HERO_ROTATING_WORDS = ['modernas', 'organizadas', 'profissionais', 'digitais'];

export const DEFAULT_BILLING = 'monthly';

export const BILLING_OPTIONS = [
  { id: 'monthly', label: 'Mensal' },
  { id: 'annual', label: 'Anual' },
];

export const PLAN_PRICING = {
  monthly: 89.9,
  annualInstallments: 12,
  annualInstallmentValue: 69.9,
  annualCash: 799,
};

export function formatPlanPrice(value, fractionDigits = 2) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export const HERO_UNLIMITED = [
  'Barbeiros ilimitados',
  'Clientes ilimitados',
  'Agendamentos ilimitados',
  'Todas as funcionalidades',
];

export const HERO_FLOATING_CARDS = [
  { id: 'appointments', icon: 'calendar', label: 'Agendamentos hoje', value: '18', accent: false },
  { id: 'revenue', icon: 'wallet', label: 'Faturamento', value: 'R$ 1.240', accent: true },
  { id: 'notifications', icon: 'bell', label: 'Novo agendamento', value: 'Lucas · 15:30', accent: false },
  { id: 'clients', icon: 'users', label: 'Clientes confirmados', value: '12 de 14', accent: false },
  { id: 'schedule', icon: 'clock', label: 'Próximo horário', value: '14:00 · Corte', accent: true },
];

export const PHONE_APPOINTMENTS = [
  { time: '09:00', client: 'Rafael M.', service: 'Corte + Barba', status: 'done' },
  { time: '10:00', client: 'Bruno S.', service: 'Corte masculino', status: 'done' },
  { time: '11:30', client: 'Diego A.', service: 'Barba completa', status: 'now' },
  { time: '13:00', client: 'Lucas P.', service: 'Corte + Barba', status: 'next' },
  { time: '14:00', client: 'Thiago R.', service: 'Corte masculino', status: 'next' },
  { time: '15:30', client: 'André L.', service: 'Sobrancelha', status: 'next' },
];

export const FRUSTRATIONS = [
  '+R$39 por barbeiro',
  'Upgrade necessário',
  'Plano Premium',
  'Usuário extra +R$19',
  'Módulo financeiro à parte',
  'Módulo de estoque à parte',
  'Limite de clientes atingido',
  'Taxas ocultas',
  'Pague mais',
  'Recurso bloqueado',
  'Plano Pro obrigatório',
  'Só no plano Enterprise',
  'Adicional mensal',
  'Limite de agendamentos',
  'Relatórios são pagos',
  'Fidelidade de 12 meses',
  '+R$29 por unidade',
  'Suporte só no plano top',
];

export const REVEAL_BADGES = [
  'Agenda',
  'Financeiro',
  'Estoque',
  'Clientes',
  'Comissões',
  'Dashboard',
  'Relatórios',
  'Área do Cliente',
  'Permissões',
  'Ranking',
  'Barbeiros Ilimitados',
  'Clientes Ilimitados',
  'Suporte',
];

export const PRICING_NEGATIVES = [
  'Sem limites.',
  'Sem módulos extras.',
  'Sem upgrades.',
  'Sem cobrar por barbeiro.',
  'Sem cobrar por cliente.',
  'Sem cobrar por usuário.',
];

export const PRICING_CHECKLIST = [
  'Agenda Online',
  'Barbeiros Ilimitados',
  'Clientes Ilimitados',
  'Financeiro Completo',
  'Controle de Estoque',
  'Fluxo de Caixa',
  'Comissão',
  'Dashboard',
  'Relatórios',
  'Área do Cliente',
  'Ranking',
  'Permissões',
  'Suporte Prioritário',
];

export const BENTO_CARDS = [
  {
    id: 'agenda',
    title: 'Agenda viva',
    text: 'Horários confirmados em tempo real, sem mensagens perdidas.',
    size: 'wide',
  },
  {
    id: 'revenue',
    title: 'Financeiro completo',
    text: 'Faturamento, fluxo de caixa e comissões em um só lugar.',
    size: 'tall',
  },
  {
    id: 'notifications',
    title: 'Notificações instantâneas',
    text: 'Cada novo agendamento chega na hora, no seu bolso.',
    size: 'normal',
  },
  {
    id: 'ranking',
    title: 'Ranking de barbeiros',
    text: 'Acompanhe o desempenho da equipe sem planilhas.',
    size: 'normal',
  },
  {
    id: 'clock',
    title: 'Disponível 24h',
    text: 'Seus clientes agendam sozinhos, a qualquer hora.',
    size: 'normal',
  },
  {
    id: 'clients',
    title: 'Área do cliente',
    text: 'Histórico, confirmação e avaliações — tudo no link da sua barbearia.',
    size: 'normal',
  },
];
