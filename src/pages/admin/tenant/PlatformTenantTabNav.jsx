import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Package, Settings, Layers } from 'lucide-react';
import { PLATFORM_TENANT_TABS, platformTenantTabPath } from './platformTenantTabs';

const TAB_ICONS = {
  resumo: LayoutDashboard,
  equipe: Users,
  estoque: Package,
  configuracao: Settings,
  modulos: Layers,
};

export default function PlatformTenantTabNav({ tenantId }) {
  return (
    <nav className="platform-tenant-tabs" role="tablist" aria-label="Seções da barbearia">
      <div className="platform-tenant-tabs__track">
        {PLATFORM_TENANT_TABS.map((tab) => {
          const Icon = TAB_ICONS[tab.id];
          return (
            <NavLink
              key={tab.id}
              to={platformTenantTabPath(tenantId, tab.id)}
              role="tab"
              className={({ isActive }) =>
                `platform-tenant-tab${isActive ? ' platform-tenant-tab--active' : ''}`
              }
            >
              {Icon ? (
                <Icon size={17} strokeWidth={2.1} aria-hidden className="platform-tenant-tab__icon" />
              ) : null}
              <span className="platform-tenant-tab__label">{tab.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
