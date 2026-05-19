import React, { lazy, Suspense, useState, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import LoginPage from './pages/LoginPage';
import TabLoadingFallback from './components/TabLoadingFallback';

import { useApp } from './context/AppContext';
import { isValidPhone } from './utils/phone';
import { Menu, LogOut } from 'lucide-react';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Clients = lazy(() => import('./pages/Clients'));
const Scheduler = lazy(() => import('./pages/Scheduler'));
const PublicBooking = lazy(() => import('./pages/PublicBooking'));
const Finance = lazy(() => import('./pages/Finance'));
const Users = lazy(() => import('./pages/Users'));
const Settings = lazy(() => import('./pages/Settings'));
const Inventory = lazy(() => import('./pages/Inventory'));
const CustomerPortal = lazy(() => import('./pages/CustomerPortal'));
const CompleteProfileGate = lazy(() => import('./components/CompleteProfileGate'));

const VALID_TABS = ['dashboard', 'clients', 'scheduler', 'finance', 'users', 'inventory', 'settings'];

const STAFF_TAB_COMPONENTS = {
  dashboard: Dashboard,
  clients: Clients,
  scheduler: Scheduler,
  finance: Finance,
  users: Users,
  inventory: Inventory,
  settings: Settings,
};

const StaffRoute = ({ children }) => {
  const { currentUser, loading } = useApp();

  if (loading) return null;
  if (!currentUser) return <Navigate to="/barbeiros/login" replace />;
  return children;
};

const CustomerRoute = ({ children }) => {
  const { currentCustomer, loading } = useApp();

  if (loading) return null;
  if (!currentCustomer) return <Navigate to="/cliente" replace />;
  return children;
};

const StaffLoginPage = () => {
  const { login, currentUser } = useApp();
  const navigate = useNavigate();

  if (currentUser) {
    return <Navigate to="/barbeiros" replace />;
  }

  const handleLogin = async (emailToLogin, pwd) => {
    try {
      const userData = await login(emailToLogin, pwd);
      const perms = userData?.permissions;
      const canDashboard = Array.isArray(perms) && perms.includes('dashboard');
      const barberNoDashboard = userData?.role === 'Barbeiro' && !canDashboard;
      if (barberNoDashboard) navigate('/barbeiros/scheduler', { replace: true });
      else navigate('/barbeiros', { replace: true });
    } catch (error) {
      alert(error.message || 'Erro ao realizar login.');
    }
  };

  return <LoginPage onLogin={handleLogin} />;
};

const CustomerArea = () => {
  const navigate = useNavigate();
  const { currentCustomer } = useApp();
  const needsPhone = !!currentCustomer && !isValidPhone(currentCustomer.phone);

  return (
    <>
      <Routes>
        <Route
          path="/"
          element={(
            <Suspense fallback={<TabLoadingFallback />}>
              <PublicBooking onOpenPortal={() => navigate('/cliente/portal')} />
            </Suspense>
          )}
        />
        <Route
          path="/portal"
          element={(
            <CustomerRoute>
              <Suspense fallback={<TabLoadingFallback />}>
                <CustomerPortal onBack={() => navigate('/cliente')} />
              </Suspense>
            </CustomerRoute>
          )}
        />
        <Route path="*" element={<Navigate to="/cliente" replace />} />
      </Routes>
      {needsPhone && (
        <Suspense fallback={null}>
          <CompleteProfileGate />
        </Suspense>
      )}
    </>
  );
};

/** Mantém abas visitadas montadas (evita refetch e remontar grade ao trocar de menu). */
function StaffTabPanels({ activeTab }) {
  const [mountedTabs, setMountedTabs] = useState(() => new Set([activeTab]));

  useEffect(() => {
    setMountedTabs((prev) => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  return (
    <>
      {VALID_TABS.map((tabId) => {
        if (!mountedTabs.has(tabId)) return null;
        const Panel = STAFF_TAB_COMPONENTS[tabId];
        const isActive = activeTab === tabId;
        return (
          <div
            key={tabId}
            className="staff-tab-panel"
            hidden={!isActive}
            style={{ display: isActive ? 'block' : 'none' }}
            aria-hidden={!isActive}
          >
            <Suspense fallback={<TabLoadingFallback />}>
              <Panel />
            </Suspense>
          </div>
        );
      })}
    </>
  );
}

const StaffArea = () => {
  const { logout, currentUser } = useApp();
  const { tab } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const activeTab = tab && VALID_TABS.includes(tab) ? tab : 'dashboard';

  const handleLogout = () => {
    logout();
    navigate('/barbeiros/login', { replace: true });
  };

  const setActiveTab = (nextTab) => {
    if (nextTab === 'dashboard') navigate('/barbeiros');
    else navigate(`/barbeiros/${nextTab}`);
  };

  React.useEffect(() => {
    if (location.pathname !== '/barbeiros') return;
    if (currentUser?.role !== 'Barbeiro') return;
    const perms = currentUser?.permissions;
    const canDashboard = Array.isArray(perms) && perms.includes('dashboard');
    if (canDashboard) return;
    navigate('/barbeiros/scheduler', { replace: true });
  }, [location.pathname, currentUser, navigate]);

  React.useEffect(() => {
    if (tab && !VALID_TABS.includes(tab)) {
      navigate('/barbeiros', { replace: true });
    }
  }, [tab, navigate]);

  return (
    <StaffRoute>
      <div className="layout">
        <div className="mobile-header">
          <button
            type="button"
            className="sidebar-toggle-btn sidebar-toggle-btn--bars"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            aria-label={isSidebarCollapsed ? 'Abrir menu' : 'Fechar menu'}
            aria-expanded={!isSidebarCollapsed}
          >
            <Menu size={24} strokeWidth={2.25} className="sidebar-menu-icon" aria-hidden />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="sloot-logo-text" style={{ fontSize: '1.2rem', paddingTop: '2px' }}>SLOOT</span>
          </div>
          <button
            type="button"
            className="sidebar-toggle-btn mobile-header-logout"
            onClick={handleLogout}
            aria-label="Sair da conta"
            title="Sair"
          >
            <LogOut size={22} strokeWidth={2} aria-hidden />
          </button>
        </div>

        <div
          className={`sidebar-overlay ${!isSidebarCollapsed ? 'active' : ''}`}
          onClick={() => setIsSidebarCollapsed(true)}
        ></div>

        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          user={currentUser}
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
          onLogout={handleLogout}
        />
        <main className={`main-content ${isSidebarCollapsed ? 'expanded' : ''}`}>
          <header className="desktop-only" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '20px', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', background: 'var(--accent-color)', color: 'var(--accent-text)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 600 }}>
                {currentUser?.name?.charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, textTransform: 'capitalize' }}>{currentUser?.name} ({currentUser?.role})</span>
            </div>
            <button onClick={toggleTheme} className="dash-icon-btn" style={{ fontSize: '1.2rem' }} title="Alternar Tema">
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            <button className="btn-secondary" onClick={handleLogout} style={{ fontSize: '0.8rem' }}>Sair</button>
          </header>
          <StaffTabPanels activeTab={activeTab} />
        </main>
      </div>
    </StaffRoute>
  );
};

function App() {
  const { loading } = useApp();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: '20px' }}>
        <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid rgba(0,0,0,0.1)', borderTop: '4px solid var(--accent-color)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <p style={{ fontWeight: 500 }}>Carregando Sloot...</p>
        <style>{`
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/cliente" replace />} />
      <Route path="/cliente/*" element={<CustomerArea />} />
      <Route path="/barbeiros/login" element={<StaffLoginPage />} />
      <Route path="/barbeiros/:tab?" element={<StaffArea />} />
      <Route path="*" element={<Navigate to="/cliente" replace />} />
    </Routes>
  );
}

export default App;
