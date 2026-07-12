import { User, Scissors, Settings as SettingsIcon, Bell } from 'lucide-react';

export const SETTINGS_TABS = [
  { id: 'barbers', label: 'Profissionais', icon: User },
  { id: 'services', label: 'Serviços', icon: Scissors },
  { id: 'business', label: 'Meu Negócio', icon: SettingsIcon },
  { id: 'notifications', label: 'Notificações', icon: Bell },
];

export const MOBILE_MQ = '(max-width: 768px)';

export const ICON_BLACK = '#1f1f1f';
export const ICON_STROKE = 2.25;
