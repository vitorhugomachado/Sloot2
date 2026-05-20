import React, { useState } from 'react';
import { Menu, LogOut } from 'lucide-react';
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
        <span className="sloot-logo-text" style={{ fontSize: '1.2rem', paddingTop: '2px' }}>
          SLOOT
        </span>
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

      <main className={`main-content platform-main-content ${isSidebarCollapsed ? 'expanded' : ''}`}>
        <header className="platform-desktop-header desktop-only">
          <div>
            <h1 className="platform-desktop-title">Administração Sloot</h1>
            <p className="platform-desktop-subtitle">Gestão de barbearias na plataforma</p>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
