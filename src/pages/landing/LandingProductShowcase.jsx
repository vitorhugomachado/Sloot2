/**
 * Showcases de produto com prints reais — moldura estilo Stripe / Linear.
 */
import {
  Scissors,
  Calendar,
  Wallet,
  Users,
  Package,
  BarChart3,
} from 'lucide-react';

export const LANDING_SCREEN_IDS = {
  dashboard: 'dashboard',
  scheduler: 'scheduler',
  booking: 'booking',
  finance: 'finance',
  clients: 'clients',
  inventory: 'inventory',
};

const ASSETS = {
  dashboard: {
    src: '/landing/dashboard.png',
    alt: 'Painel Slooti com indicadores, performance e agenda do dia',
    title: 'Dashboard',
  },
  scheduler: {
    src: '/landing/scheduler.png',
    alt: 'Agenda por profissional com horários e atendimentos',
    title: 'Agenda',
  },
  booking: {
    src: '/landing/booking-mobile.png',
    alt: 'Agendamento online pelo celular',
    title: 'Agendamento',
  },
  finance: {
    src: '/landing/finance.png',
    alt: 'Financeiro com receita, gráficos e relatórios',
    title: 'Financeiro',
  },
  clients: {
    src: '/landing/clients.png',
    alt: 'Gestão de clientes e histórico',
    title: 'Clientes',
  },
  inventory: {
    src: '/landing/inventory.png',
    alt: 'Controle de estoque e produtos',
    title: 'Estoque',
  },
};

export function ProductShowcase({ screen = 'dashboard', variant = 'default', className = '' }) {
  const asset = ASSETS[screen] || ASSETS.dashboard;
  const isPhone = variant === 'phone' || screen === 'booking';

  if (isPhone) {
    return (
      <div className={`lp-showcase lp-showcase--phone ${className}`.trim()}>
        <div className="lp-showcase__halo" aria-hidden />
        <div className="lp-phone-device">
          <div className="lp-phone-device__island" aria-hidden />
          <div className="lp-phone-device__screen">
            <img
              src={asset.src}
              alt={asset.alt}
              loading={variant === 'hero' ? 'eager' : 'lazy'}
              decoding="async"
              draggable={false}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`lp-showcase lp-showcase--${variant} ${className}`.trim()}>
      <div className="lp-showcase__halo" aria-hidden />
      <div className="lp-showcase__browser">
        <div className="lp-showcase__bar" aria-hidden>
          <span /><span /><span />
          <div className="lp-showcase__url">app.slooti.com.br</div>
        </div>
        <div className="lp-showcase__viewport">
          <img
            src={asset.src}
            alt={asset.alt}
            loading={variant === 'hero' ? 'eager' : 'lazy'}
            fetchPriority={variant === 'hero' ? 'high' : undefined}
            decoding="async"
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
}

/** @deprecated alias */
export function LandingScreenMock({ screen, variant = 'default' }) {
  if (screen === 'booking') {
    return <ProductShowcase screen="booking" variant="phone" />;
  }
  return <ProductShowcase screen={screen} variant={variant} />;
}

export const FEATURE_TAB_SCREENS = {
  agenda: LANDING_SCREEN_IDS.scheduler,
  gestao: LANDING_SCREEN_IDS.clients,
  financeiro: LANDING_SCREEN_IDS.finance,
};

export const PERSONA_SCREENS = {
  owner: LANDING_SCREEN_IDS.dashboard,
  pro: LANDING_SCREEN_IDS.scheduler,
  client: LANDING_SCREEN_IDS.booking,
};

export const BENTO_MODULES = [
  { id: LANDING_SCREEN_IDS.dashboard, label: 'Dashboard', icon: BarChart3, span: 'hero', screen: 'dashboard' },
  { id: LANDING_SCREEN_IDS.scheduler, label: 'Agenda', icon: Calendar, span: 'wide', screen: 'scheduler' },
  { id: LANDING_SCREEN_IDS.finance, label: 'Financeiro', icon: Wallet, span: 'wide', screen: 'finance' },
  { id: LANDING_SCREEN_IDS.booking, label: 'Agendamento online', icon: Scissors, span: 'phone', screen: 'booking' },
  { id: LANDING_SCREEN_IDS.clients, label: 'Clientes', icon: Users, span: 'normal', screen: 'clients' },
  { id: LANDING_SCREEN_IDS.inventory, label: 'Estoque', icon: Package, span: 'normal', screen: 'inventory' },
];
