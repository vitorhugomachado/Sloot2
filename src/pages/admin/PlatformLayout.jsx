import React, { useState } from 'react';
import { Menu, LogOut } from 'lucide-react';
import SlootiLogo from '../../components/SlootiLogo';
import PlatformSidebar from './PlatformSidebar';

export default function PlatformLayout({ children, onLogout }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);

  return (
    <div className="layout platform-layout">
      <div className="mobile-header platform-mobile-header">
        <button
          type="button"
          className="sidebar-toggle-btn sidebar-toggle-btn--bars"
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          aria-label={isSidebarCollapsed ? 'Abrir menu' : 'Fechar menu'}
          aria-expanded={!isSidebarCollapsed}
        >
          <Menu size={24} strokeWidth={2.25} className="sidebar-menu-icon" aria-hidden />
        </button>
        <SlootiLogo size="md" onDark={false} />
        <button
          type="button"
          className="sidebar-toggle-btn mobile-header-logout"
          onClick={onLogout}
          aria-label="Sair"
          title="Sair"
        >
          <LogOut size={22} strokeWidth={2} aria-hidden />
        </button>
      </div>

      <div
        className={`sidebar-overlay ${!isSidebarCollapsed ? 'active' : ''}`}
        onClick={() => setIsSidebarCollapsed(true)}
        aria-hidden
      />

      <PlatformSidebar
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        onLogout={onLogout}
      />

      <main className={`main-content ${isSidebarCollapsed ? 'expanded' : ''}`}>
        {children}
      </main>
    </div>
  );
}
