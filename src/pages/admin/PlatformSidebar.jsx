import { useRef, useEffect } from 'react';
import { Store, LogOut, Menu } from 'lucide-react';
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

  return (
    <aside
      className={`sidebar platform-sidebar ${isCollapsed ? 'collapsed' : ''} ${!isCollapsed ? 'active' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="brand" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '1.5rem' }}>
        <SlootiLogo size="lg" variant={isCollapsed ? 'mark' : 'full'} />
        <button
          type="button"
          className="sidebar-toggle-btn sidebar-toggle-btn--bars"
          onClick={handleToggleClick}
          aria-label={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          <Menu size={22} strokeWidth={2.25} className="sidebar-menu-icon" aria-hidden />
        </button>
      </div>

      <p className={`platform-sidebar-subtitle ${isCollapsed ? 'platform-sidebar-subtitle--hidden' : ''}`}>
        Administração
      </p>

      <nav className="nav-menu">
        <button type="button" className="nav-item active" aria-current="page">
          <Store size={20} />
          <span>Barbearias</span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <button type="button" className="sidebar-logout-btn" onClick={onLogout} title="Sair">
          <LogOut size={20} />
          {!isCollapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
}
