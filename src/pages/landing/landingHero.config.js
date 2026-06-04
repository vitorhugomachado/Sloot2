export const LANDING_HERO_AUTOPLAY_MS = 6000;

const HERO_EYEBROW = 'Software para barbearias';
const HERO_PRIMARY_CTA = { label: 'Começar teste grátis' };
const HERO_SECONDARY_CTA = { label: 'Ver planos', href: '#planos' };

export const LANDING_HERO_SLIDES = [
  {
    id: 'valor',
    variant: 'editorial',
    eyebrow: HERO_EYEBROW,
    headlineLines: [
      { text: 'Mais tempo.', accent: false },
      { text: 'Mais clientes.', accent: false },
      { text: 'Mais resultados.', accent: true },
    ],
    title: 'Mais resultados.',
    primaryCta: HERO_PRIMARY_CTA,
    secondaryCta: HERO_SECONDARY_CTA,
  },
  {
    id: 'agenda',
    image: '/landing/hero/hero-agenda.png',
    imageAlt: 'Barbearia com smartphone mostrando grade de horários',
    eyebrow: HERO_EYEBROW,
    title: 'Agenda que preenche sozinha',
    subtitle:
      'Clientes agendam online 24 horas por dia. Horários, serviços e profissionais sincronizados em tempo real — sem ligações e sem caderno.',
    primaryCta: HERO_PRIMARY_CTA,
    secondaryCta: HERO_SECONDARY_CTA,
  },
  {
    id: 'equipe',
    image: '/landing/hero/hero-equipe.png',
    imageAlt: 'Equipe de barbeiros na barbearia, ambiente organizado',
    eyebrow: HERO_EYEBROW,
    title: 'Sua equipe no mesmo ritmo',
    subtitle:
      'Cada barbeiro com agenda própria, comissões automáticas e visão clara do dia. Menos confusão, mais cadeiras ocupadas.',
    primaryCta: HERO_PRIMARY_CTA,
    secondaryCta: HERO_SECONDARY_CTA,
  },
  {
    id: 'financeiro',
    image: '/landing/hero/hero-financeiro.png',
    imageAlt: 'Gestor com tablet e gráficos de receita da barbearia',
    eyebrow: HERO_EYEBROW,
    title: 'Financeiro sem planilha',
    subtitle:
      'Entradas, saídas e relatórios em um só lugar. Saiba quanto sua barbearia faturou hoje — e o que pode melhorar amanhã.',
    primaryCta: HERO_PRIMARY_CTA,
    secondaryCta: HERO_SECONDARY_CTA,
  },
];
