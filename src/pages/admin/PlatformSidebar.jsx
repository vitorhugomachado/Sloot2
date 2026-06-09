import { useRef, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Store, LogOut, Menu, LayoutDashboard, Users } from 'lucide-react';
import SlootiLogo from '../../components/SlootiLogo';

const SIDEBAR_LEAVE_MS = 110;

export default function PlatformSidebar({ isCollapsed, setIsCollapsed, onLogout }) {
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

  const navClass = ({ isActive }) => `nav-item${isActive ? ' active' : ''}`;

  return (
    <aside
      className={`sidebar platform-sidebar ${isCollapsed ? 'collapsed' : ''} ${!isCollapsed ? 'active' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className="brand"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'space-between',
          gap: '10px',
          marginBottom: '1.5rem',
        }}
      >
        <SlootiLogo size="lg" variant={isCollapsed ? 'mark' : 'full'} onDark />
        {!isCollapsed && (
          <button
            type="button"
            className="sidebar-toggle-btn sidebar-toggle-btn--bars"
            onClick={handleToggleClick}
            aria-label="Recolher menu"
          >
            <Menu size={22} strokeWidth={2.25} className="sidebar-menu-icon" aria-hidden />
          </button>
        )}
      </div>

      <p className={`platform-sidebar-subtitle ${isCollapsed ? 'platform-sidebar-subtitle--hidden' : ''}`}>
        Administração
      </p>

      <nav className="nav-menu">
        <NavLink to="/admin" end className={navClass}>
          <LayoutDashboard size={20} aria-hidden />
          <span className="nav-item-label">Visão geral</span>
        </NavLink>
        <NavLink to="/admin/barbearias" className={navClass}>
          <Store size={20} aria-hidden />
          <span className="nav-item-label">Barbearias</span>
        </NavLink>
        <NavLink to="/admin/admins" className={navClass}>
          <Users size={20} aria-hidden />
          <span className="nav-item-label">Admins</span>
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <button type="button" className="sidebar-logout-btn" onClick={onLogout} title="Sair">
          <LogOut size={20} aria-hidden />
          <span className="nav-item-label">Sair</span>
        </button>
      </div>
    </aside>
  );
}
