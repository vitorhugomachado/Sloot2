import { useRef, useEffect } from 'react';
import { LayoutDashboard, Calendar, Users, Settings, DollarSign, Shield, Menu, X, Package, LogOut } from 'lucide-react';
import SlootiLogo from './SlootiLogo';

const SIDEBAR_LEAVE_MS = 110;

const Sidebar = ({ activeTab, setActiveTab, user, isCollapsed, setIsCollapsed, onLogout }) => {
  const leaveCloseTimer = useRef(null);

  const clearCloseTimer = () => {
    if (leaveCloseTimer.current) {
      clearTimeout(leaveCloseTimer.current);
      leaveCloseTimer.current = null;
    }
  };

  useEffect(() => () => clearCloseTimer(), []);

  const handleMouseEnter = () => {
    if (window.innerWidth <= 768) return;
    clearCloseTimer();
    setIsCollapsed(false);
  };

  const handleMouseLeave = () => {
    if (window.innerWidth <= 768) return;
    clearCloseTimer();
    leaveCloseTimer.current = window.setTimeout(() => setIsCollapsed(true), SIDEBAR_LEAVE_MS);
  };

  const handleToggleClick = (e) => {
    e.stopPropagation();
    clearCloseTimer();
    setIsCollapsed(!isCollapsed);
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard /> },
    { id: 'scheduler', label: 'Agendamentos', icon: <Calendar /> },
    { id: 'clients', label: 'Clientes', icon: <Users /> },
    { id: 'finance', label: 'Financeiro', icon: <DollarSign /> },
    { id: 'users', label: 'Usuários', icon: <Shield /> },
    { id: 'inventory', label: 'Estoque', icon: <Package /> },
    { id: 'settings', label: 'Configurações', icon: <Settings /> },
  ];

  return (
    <div 
      className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${!isCollapsed ? 'active' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="brand" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <SlootiLogo size="lg" variant={isCollapsed ? 'mark' : 'full'} />
        </div>
        
        {/* Toggle Controls */}
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          <button
            type="button"
            className="sidebar-toggle-btn sidebar-toggle-btn--bars desktop-only"
            onClick={handleToggleClick}
            title={isCollapsed ? "Expandir menu" : "Recolher menu"}
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
          >
            <Menu size={22} strokeWidth={2.25} className="sidebar-menu-icon" aria-hidden />
          </button>
          <button type="button" className="sidebar-toggle-btn mobile-only" onClick={() => setIsCollapsed(true)} aria-label="Fechar menu">
            <X size={20} />
          </button>
        </div>
      </div>

      <nav style={{ flex: 1 }}>
        {menuItems
          .filter((item) => {
            const hasDirectPermission = user?.permissions?.includes(item.id);
            const hasLegacyInventoryPermission = item.id === 'inventory' && user?.permissions?.includes('products');
            const isManagerInventory = item.id === 'inventory' && user?.role === 'Gerente';
            const isManagerSettings = item.id === 'settings' && user?.role === 'Gerente';
            return hasDirectPermission || hasLegacyInventoryPermission || isManagerInventory || isManagerSettings;
          })
          .map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={(e) => {
              e.preventDefault();
              setActiveTab(item.id);
              if (window.innerWidth <= 768) setIsCollapsed(true);
            }}
          >
            {item.icon}
            <span className="nav-item-label" style={{ fontWeight: 500 }}>{item.label}</span>
          </a>
        ))}
      </nav>

      {onLogout && (
        <footer className="sidebar-footer">
          <div className="sidebar-footer-user sidebar-footer-detail">
            <div className="sidebar-footer-avatar" aria-hidden>
              {user?.name?.charAt(0).toUpperCase() || '?'}
            </div>
            <div className="sidebar-footer-user-text">
              <span className="sidebar-footer-name">{user?.name}</span>
              <span className="sidebar-footer-role">{user?.role}</span>
            </div>
          </div>
          <button
            type="button"
            className="sidebar-logout-btn"
            onClick={() => {
              onLogout();
              if (window.innerWidth <= 768) setIsCollapsed(true);
            }}
          >
            <LogOut size={20} strokeWidth={2} aria-hidden />
            <span className="nav-item-label sidebar-footer-detail">Sair</span>
          </button>
        </footer>
      )}

    </div>
  );
};

export default Sidebar;
