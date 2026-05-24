import React, { lazy, Suspense, useState, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import LoginPage from './pages/LoginPage';
import TabLoadingFallback from './components/TabLoadingFallback';
import PlatformAdminApp from './pages/admin/PlatformAdminApp';
import BookingPreviewShell from './pages/preview/BookingPreviewShell';
import LoginPreviewShell from './pages/preview/LoginPreviewShell';
import { AppProvider, useApp } from './context/AppContext';
import { TenantProvider, useTenant, DEFAULT_SLUG } from './context/TenantContext';
import { getPendingCustomer } from './utils/tenantAuthStorage';
import { isValidPhone } from './utils/phone';
import { Menu, LogOut } from 'lucide-react';
import SlootiLogo from './components/SlootiLogo';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Clients = lazy(() => import('./pages/Clients'));
const Scheduler = lazy(() => import('./pages/Scheduler'));
const PublicBookingPage = lazy(() => import('./pages/public-booking/PublicBookingPage'));
const CustomerAreaLayout = lazy(() => import('./pages/public-booking/CustomerAreaLayout'));
const Finance = lazy(() => import('./pages/Finance'));
const Users = lazy(() => import('./pages/Users'));
const Settings = lazy(() => import('./pages/Settings'));
const Inventory = lazy(() => import('./pages/Inventory'));
const CustomerPortal = lazy(() => import('./pages/CustomerPortal'));
const CustomerResetPasswordPage = lazy(() => import('./pages/public-booking/CustomerResetPasswordPage'));
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

function useTenantBase() {
  const { slug } = useTenant();
  return `/${slug}`;
}

const StaffRoute = ({ children }) => {
  const { currentUser, staffLoading } = useApp();
  const base = useTenantBase();

  if (staffLoading && !currentUser) return null;
  if (!currentUser) return <Navigate to={`${base}/barbeiros/login`} replace />;
  return children;
};

const CustomerRoute = ({ children }) => {
  const {
    currentCustomer,
    bootstrapLoading,
    isCustomerAuthenticated,
    refreshCurrentCustomer,
    syncNavigatedCustomer,
  } = useApp();
  const { slug } = useTenant();
  const base = useTenantBase();
  const location = useLocation();
  const navCustomer = location.state?.customer;
  const pendingCustomer = getPendingCustomer(slug);
  const [authResolved, setAuthResolved] = useState(false);

  const transientCustomer = navCustomer || pendingCustomer;
  const effectiveCustomer = currentCustomer || transientCustomer;
  const hasCustomerAccess = isCustomerAuthenticated || !!transientCustomer;

  useEffect(() => {
    if (transientCustomer && !currentCustomer) {
      syncNavigatedCustomer(transientCustomer);
    }
  }, [transientCustomer, currentCustomer, syncNavigatedCustomer]);

  useEffect(() => {
    setAuthResolved(false);
    if (!hasCustomerAccess) {
      setAuthResolved(true);
      return undefined;
    }
    if (effectiveCustomer) {
      setAuthResolved(true);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      await refreshCurrentCustomer();
      if (!cancelled) setAuthResolved(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    hasCustomerAccess,
    effectiveCustomer,
    refreshCurrentCustomer,
  ]);

  if (bootstrapLoading) {
    return <TabLoadingFallback />;
  }
  if (!hasCustomerAccess) {
    return (
      <Navigate
        to={`${base}/cliente`}
        replace
        state={{ portalLogin: true }}
      />
    );
  }
  if (!effectiveCustomer) {
    if (!authResolved) return <TabLoadingFallback />;
    return (
      <Navigate
        to={`${base}/cliente`}
        replace
        state={{ portalLogin: true }}
      />
    );
  }
  return children;
};

const StaffLoginPage = () => {
  const { login, currentUser } = useApp();
  const navigate = useNavigate();
  const base = useTenantBase();

  if (currentUser) {
    return <Navigate to={`${base}/barbeiros`} replace />;
  }

  const handleLogin = async (emailToLogin, pwd) => {
    const userData = await login(emailToLogin, pwd);
    const perms = userData?.permissions;
    const canDashboard = Array.isArray(perms) && perms.includes('dashboard');
    const barberNoDashboard = userData?.role === 'Barbeiro' && !canDashboard;
    if (barberNoDashboard) navigate(`${base}/barbeiros/scheduler`, { replace: true });
    else navigate(`${base}/barbeiros`, { replace: true });
  };

  return <LoginPage onLogin={handleLogin} />;
};

const CustomerArea = () => {
  const navigate = useNavigate();
  const base = useTenantBase();
  const { currentCustomer } = useApp();
  const needsPhone = !!currentCustomer && !isValidPhone(currentCustomer.phone);

  return (
    <>
      <Routes>
        <Route
          element={(
            <Suspense fallback={<TabLoadingFallback />}>
              <CustomerAreaLayout />
            </Suspense>
          )}
        >
          <Route
            index
            element={(
              <Suspense fallback={<TabLoadingFallback />}>
                <PublicBookingPage />
              </Suspense>
            )}
          />
          <Route
            path="portal"
            element={(
              <CustomerRoute>
                <Suspense fallback={<TabLoadingFallback />}>
                  <CustomerPortal onBack={() => navigate(`${base}/cliente`)} />
                </Suspense>
              </CustomerRoute>
            )}
          />
          <Route
            path="redefinir-senha"
            element={(
              <Suspense fallback={<TabLoadingFallback />}>
                <CustomerResetPasswordPage />
              </Suspense>
            )}
          />
          <Route path="*" element={<Navigate to={`${base}/cliente`} replace />} />
        </Route>
      </Routes>
      {needsPhone && (
        <Suspense fallback={null}>
          <CompleteProfileGate />
        </Suspense>
      )}
    </>
  );
};

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
  const base = useTenantBase();
  const staffHome = `${base}/barbeiros`;
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);

  React.useEffect(() => {
    document.documentElement.removeAttribute('data-theme');
    localStorage.removeItem('theme');
  }, []);

  const activeTab = tab && VALID_TABS.includes(tab) ? tab : 'dashboard';

  const handleLogout = () => {
    logout();
    navigate(`${base}/barbeiros/login`, { replace: true });
  };

  const setActiveTab = (nextTab) => {
    if (nextTab === 'dashboard') navigate(staffHome);
    else navigate(`${staffHome}/${nextTab}`);
  };

  React.useEffect(() => {
    if (location.pathname !== staffHome) return;
    if (currentUser?.role !== 'Barbeiro') return;
    const perms = currentUser?.permissions;
    const canDashboard = Array.isArray(perms) && perms.includes('dashboard');
    if (canDashboard) return;
    navigate(`${staffHome}/scheduler`, { replace: true });
  }, [location.pathname, currentUser, navigate, staffHome]);

  React.useEffect(() => {
    if (tab && !VALID_TABS.includes(tab)) {
      navigate(staffHome, { replace: true });
    }
  }, [tab, navigate, staffHome]);

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
            <SlootiLogo size="md" />
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
        />

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
            <button type="button" className="btn-secondary" onClick={handleLogout} style={{ fontSize: '0.8rem' }}>Sair</button>
          </header>
          <StaffTabPanels activeTab={activeTab} />
        </main>
      </div>
    </StaffRoute>
  );
};

function LoadingScreen({ message = 'Carregando slooti...' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: '20px' }}>
      <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid rgba(0,0,0,0.1)', borderTop: '4px solid var(--accent-color)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <p style={{ fontWeight: 500 }}>{message}</p>
      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function TenantAppContent() {
  const { slug: tenantSlug, loading: tenantLoading, error: tenantError } = useTenant();
  const { bootstrapLoading } = useApp();
  const location = useLocation();
  const isStaffRoute = /\/barbeiros(\/|$)/.test(location.pathname);

  if (tenantLoading) {
    return <LoadingScreen />;
  }

  if (bootstrapLoading && !isStaffRoute) {
    return <LoadingScreen />;
  }

  if (tenantError) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: '12px', padding: '24px', textAlign: 'center' }}>
        <p style={{ fontWeight: 600, margin: 0 }}>{tenantError}</p>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
          Confirma o slug na URL (ex.: /two-brothers/cliente) e que o backend está a correr.
        </p>
      </div>
    );
  }

  const clienteHome = `/${tenantSlug}/cliente`;

  return (
    <Routes>
      <Route path="cliente/*" element={<CustomerArea />} />
      <Route path="clientes/*" element={<Navigate to={clienteHome} replace />} />
      <Route path="barbeiros/login" element={<StaffLoginPage />} />
      <Route path="barbeiros/:tab?" element={<StaffArea />} />
      <Route path="*" element={<Navigate to={clienteHome} replace />} />
    </Routes>
  );
}

function TenantShell() {
  const { tenantSlug } = useParams();
  return (
    <TenantProvider key={tenantSlug}>
      <AppProvider>
        <TenantAppContent />
      </AppProvider>
    </TenantProvider>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/admin/*" element={<PlatformAdminApp />} />
      <Route path="/platform" element={<Navigate to="/admin" replace />} />
      <Route path="/cadastro" element={<Navigate to="/" replace />} />
      <Route path="/telateste" element={<BookingPreviewShell />} />
      <Route path="/telaloginteste" element={<LoginPreviewShell />} />
      <Route path="/cliente/*" element={<Navigate to={`/${DEFAULT_SLUG}/cliente`} replace />} />
      <Route path="/barbeiros/*" element={<Navigate to={`/${DEFAULT_SLUG}/barbeiros`} replace />} />
      <Route path="/:tenantSlug/*" element={<TenantShell />} />
      <Route path="/" element={<Navigate to={`/${DEFAULT_SLUG}/cliente`} replace />} />
      <Route path="*" element={<Navigate to={`/${DEFAULT_SLUG}/cliente`} replace />} />
    </Routes>
  );
}

export default App;
