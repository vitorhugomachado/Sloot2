import React, { lazy, Suspense, useState, useEffect } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import StaffToast from './components/StaffToast';
import Sidebar from './components/Sidebar';
import StaffLoginPage from './pages/StaffLoginPage';
import TabLoadingFallback from './components/TabLoadingFallback';
import PlatformAdminApp, { PlatformAdminOutlet } from './pages/admin/PlatformAdminApp';
import PlatformAdminPage from './pages/admin/PlatformAdminPage';
import PlatformDashboardPage from './pages/admin/PlatformDashboardPage';
import PlatformTenantsPage from './pages/admin/PlatformTenantsPage';
import PlatformTenantDetailPage from './pages/admin/PlatformTenantDetailPage';
import PlatformAdminsPage from './pages/admin/PlatformAdminsPage';
import { AppProvider, useApp } from './context/AppContext';
import { TenantProvider, useTenant } from './context/TenantContext';
import { getPendingCustomer } from './utils/tenantAuthStorage';
import { isValidPhone } from './utils/phone';
import {
  isReservedTenantSlug,
  isStaffRoutePath,
  mapLegacyTenantPath,
  tenantBookingPath,
  tenantDashboardPath,
  tenantLoginPath,
  tenantPortalPath,
} from './constants/tenantRoutes';
import { Menu, LogOut } from 'lucide-react';
import SlootiLogo from './components/SlootiLogo';
import HomeLanding from './pages/HomeLanding';
import PaginadeVendasRoute from './pages/PaginadeVendasRoute';
import { filterStaffNavModules } from './utils/staffNavModules';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Clients = lazy(() => import('./pages/Clients'));
const Scheduler = lazy(() => import('./pages/SchedulerWeek'));
const PublicBookingPage = lazy(() => import('./pages/public-booking/PublicBookingPage'));
const CustomerAreaLayout = lazy(() => import('./pages/public-booking/CustomerAreaLayout'));
const FinanceV2 = lazy(() => import('./pages/FinanceV2'));
const Users = lazy(() => import('./pages/Users'));
const Settings = lazy(() => import('./pages/Settings'));
const Inventory = lazy(() => import('./pages/Inventory'));
const CustomerPortal = lazy(() => import('./pages/CustomerPortal'));
const CustomerResetPasswordPage = lazy(() => import('./pages/public-booking/CustomerResetPasswordPage'));
const CompleteProfileGate = lazy(() => import('./components/CompleteProfileGate'));
const Landing3Page = lazy(() => import('./pages/landing3/Landing3Page'));
const SlootiSitePage = lazy(() => import('./pages/slootisite/SlootiSitePage'));

const VALID_TABS = ['dashboard', 'clients', 'scheduler', 'financeiro', 'users', 'inventory', 'settings'];

const STAFF_TAB_COMPONENTS = {
  dashboard: Dashboard,
  clients: Clients,
  scheduler: Scheduler,
  financeiro: FinanceV2,
  users: Users,
  inventory: Inventory,
  settings: Settings,
};

function LegacyClienteRedirect() {
  const { slug } = useTenant();
  const params = useParams();
  const splat = params['*'] || '';
  const mapped = mapLegacyTenantPath(splat ? `cliente/${splat}` : 'cliente');
  const to = mapped ? `${tenantBookingPath(slug)}/${mapped}` : tenantBookingPath(slug);
  return <Navigate to={to} replace />;
}

function LegacyBarbeirosRedirect() {
  const { slug } = useTenant();
  const params = useParams();
  const splat = params['*'] || '';
  const mapped = mapLegacyTenantPath(splat ? `barbeiros/${splat}` : 'barbeiros');
  const to = mapped ? `${tenantBookingPath(slug)}/${mapped}` : tenantDashboardPath(slug);
  return <Navigate to={to} replace />;
}

const StaffRoute = ({ children }) => {
  const { currentUser, staffLoading } = useApp();
  const { slug } = useTenant();

  if (staffLoading && !currentUser) return null;
  if (!currentUser) return <Navigate to={tenantLoginPath(slug)} replace />;
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
  }, [hasCustomerAccess, effectiveCustomer, refreshCurrentCustomer]);

  if (bootstrapLoading) {
    return <TabLoadingFallback />;
  }
  if (!hasCustomerAccess) {
    return (
      <Navigate
        to={tenantBookingPath(slug)}
        replace
        state={{ portalLogin: true }}
      />
    );
  }
  if (!effectiveCustomer) {
    if (!authResolved) return <TabLoadingFallback />;
    return (
      <Navigate
        to={tenantBookingPath(slug)}
        replace
        state={{ portalLogin: true }}
      />
    );
  }
  return children;
};

const CustomerBookingIndex = () => {
  const { currentCustomer } = useApp();
  const needsPhone = !!currentCustomer && !isValidPhone(currentCustomer.phone);

  return (
    <>
      <Suspense fallback={<TabLoadingFallback />}>
        <PublicBookingPage />
      </Suspense>
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
              <Panel isActive={isActive} />
            </Suspense>
          </div>
        );
      })}
    </>
  );
}

// A prévia fica disponível no ambiente local e no domínio isolado de staging,
// sem expor a rota de teste no domínio de produção.
const MOBILE_BOOKING_TEST_HOSTS = new Set(['sloot2-staging.up.railway.app']);
const isMobileBookingStagingHost = typeof window !== 'undefined'
  && MOBILE_BOOKING_TEST_HOSTS.has(window.location.hostname);
const mobileBookingTestEnabled = import.meta.env.DEV
  || isMobileBookingStagingHost;

const BookingPreviewShell = import.meta.env.DEV
  ? lazy(() => import('./pages/preview/BookingPreviewShell'))
  : null;
const LoginPreviewShell = import.meta.env.DEV
  ? lazy(() => import('./pages/preview/LoginPreviewShell'))
  : null;
const SchedulerWeekPreview = import.meta.env.DEV
  ? lazy(() => import('./pages/preview/SchedulerWeekPreviewShell'))
  : null;
const MobileBookingTestPage = mobileBookingTestEnabled
  ? lazy(() => import('./pages/preview/MobileBookingTestPage'))
  : null;

const StaffArea = () => {
  const { logout, currentUser, tenantModules } = useApp();
  const { tab } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { slug } = useTenant();
  const staffHome = tenantDashboardPath(slug);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);

  React.useEffect(() => {
    document.documentElement.removeAttribute('data-theme');
    localStorage.removeItem('theme');
  }, []);

  const activeTab = tab && VALID_TABS.includes(tab) ? tab : 'dashboard';

  const allowedTabs = React.useMemo(
    () => filterStaffNavModules(VALID_TABS, currentUser?.permissions, tenantModules),
    [currentUser?.permissions, tenantModules],
  );

  const firstAllowedTab = allowedTabs[0] || 'dashboard';

  const handleLogout = () => {
    logout();
    navigate(tenantLoginPath(slug), { replace: true });
  };

  const setActiveTab = (nextTab) => {
    const path = tenantDashboardPath(slug, nextTab === 'dashboard' ? undefined : nextTab);
    navigate(
      path,
      nextTab === 'scheduler'
        ? { state: { schedulerDayView: true, at: Date.now() } }
        : undefined
    );
  };

  React.useEffect(() => {
    if (location.pathname !== staffHome) return;
    if (currentUser?.role !== 'Barbeiro') return;
    const perms = currentUser?.permissions;
    const canDashboard = Array.isArray(perms) && perms.includes('dashboard');
    if (canDashboard) return;
    const fallback = allowedTabs.find((t) => t !== 'dashboard') || firstAllowedTab;
    navigate(tenantDashboardPath(slug, fallback === 'dashboard' ? undefined : fallback), {
      replace: true,
      state: fallback === 'scheduler' ? { schedulerDayView: true, at: Date.now() } : undefined,
    });
  }, [location.pathname, currentUser, navigate, staffHome, slug, allowedTabs, firstAllowedTab]);

  React.useEffect(() => {
    if (!tab || !VALID_TABS.includes(tab)) return;
    if (allowedTabs.includes(tab)) return;
    navigate(tenantDashboardPath(slug, firstAllowedTab === 'dashboard' ? undefined : firstAllowedTab), {
      replace: true,
      state: firstAllowedTab === 'scheduler' ? { schedulerDayView: true, at: Date.now() } : undefined,
    });
  }, [tab, allowedTabs, firstAllowedTab, navigate, slug]);

  React.useEffect(() => {
    if (tab === 'finance') {
      navigate(tenantDashboardPath(slug, 'financeiro'), { replace: true });
      return;
    }
    if (tab && !VALID_TABS.includes(tab)) {
      navigate(staffHome, { replace: true });
    }
  }, [tab, navigate, staffHome, slug]);

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
            <SlootiLogo size="md" onDark={false} />
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
          tenantModules={tenantModules}
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
          onLogout={handleLogout}
        />
        <main className={`main-content ${isSidebarCollapsed ? 'expanded' : ''}`}>
          <StaffTabPanels activeTab={activeTab} />
        </main>
        <StaffToast />
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
  const isStaffRoute = isStaffRoutePath(location.pathname);

  if (tenantLoading) {
    return <LoadingScreen />;
  }

  if (tenantError) {
    return <Navigate to="/" replace />;
  }

  if (bootstrapLoading && !isStaffRoute) {
    return <LoadingScreen />;
  }

  const bookingHome = tenantBookingPath(tenantSlug);

  return (
    <Routes>
      <Route
        element={(
          <Suspense fallback={<TabLoadingFallback />}>
            <CustomerAreaLayout />
          </Suspense>
        )}
      >
        {!isMobileBookingStagingHost ? <Route index element={<CustomerBookingIndex />} /> : null}
        <Route path="portal" element={<TenantPortalWrapper />} />
        <Route
          path="redefinir-senha"
          element={(
            <Suspense fallback={<TabLoadingFallback />}>
              <CustomerResetPasswordPage />
            </Suspense>
          )}
        />
      </Route>
      {isMobileBookingStagingHost && MobileBookingTestPage ? (
        <Route
          index
          element={(
            <Suspense fallback={<TabLoadingFallback />}>
              <MobileBookingTestPage tenantSlug={tenantSlug} />
            </Suspense>
          )}
        />
      ) : null}
      <Route path="login" element={<StaffLoginPage />} />
      <Route path="dashboard" element={<StaffArea />} />
      <Route path="dashboard/:tab" element={<StaffArea />} />
      <Route path="cliente/*" element={<LegacyClienteRedirect />} />
      <Route path="clientes/*" element={<Navigate to={bookingHome} replace />} />
      <Route path="barbeiros/*" element={<LegacyBarbeirosRedirect />} />
      <Route path="admin/*" element={<Navigate to="/admin" replace />} />
      <Route path="*" element={<Navigate to={bookingHome} replace />} />
    </Routes>
  );
}

function TenantPortalWrapper() {
  const { slug } = useTenant();
  const navigate = useNavigate();
  return (
    <CustomerRoute>
      <Suspense fallback={<TabLoadingFallback />}>
        <CustomerPortal onBack={() => navigate(tenantBookingPath(slug))} />
      </Suspense>
    </CustomerRoute>
  );
}

function TenantShell() {
  const { tenantSlug } = useParams();
  if (isReservedTenantSlug(tenantSlug)) {
    return <Navigate to="/" replace />;
  }
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
      <Route path="/admin" element={<PlatformAdminApp />}>
        <Route index element={<PlatformAdminPage page={PlatformDashboardPage} />} />
        <Route path="barbearias" element={<PlatformAdminOutlet />}>
          <Route index element={<PlatformAdminPage page={PlatformTenantsPage} />} />
          <Route path=":id" element={<PlatformAdminPage page={PlatformTenantDetailPage} />} />
          <Route path=":id/:tab" element={<PlatformAdminPage page={PlatformTenantDetailPage} />} />
        </Route>
        <Route path="admins" element={<PlatformAdminPage page={PlatformAdminsPage} />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
      <Route path="/platform" element={<Navigate to="/admin" replace />} />
      <Route path="/cadastro" element={<Navigate to="/" replace />} />
      {import.meta.env.DEV && BookingPreviewShell ? (
        <>
          <Route
            path="/telateste"
            element={(
              <Suspense fallback={<TabLoadingFallback />}>
                <BookingPreviewShell />
              </Suspense>
            )}
          />
          <Route
            path="/telaloginteste"
            element={(
              <Suspense fallback={<TabLoadingFallback />}>
                <LoginPreviewShell />
              </Suspense>
            )}
          />
          <Route
            path="/agendamentomobile-teste"
            element={(
              <Suspense fallback={<TabLoadingFallback />}>
                <MobileBookingTestPage />
              </Suspense>
            )}
          />
          {SchedulerWeekPreview ? (
            <Route
              path="/agenda-teste"
              element={(
                <Suspense fallback={<TabLoadingFallback />}>
                  <SchedulerWeekPreview />
                </Suspense>
              )}
            />
          ) : null}
        </>
      ) : (
        <>
          <Route path="/telateste" element={<Navigate to="/" replace />} />
          <Route path="/telaloginteste" element={<Navigate to="/" replace />} />
          <Route path="/agenda-teste" element={<Navigate to="/" replace />} />
          {MobileBookingTestPage ? (
            <Route
              path="/agendamentomobile-teste"
              element={(
                <Suspense fallback={<TabLoadingFallback />}>
                  <MobileBookingTestPage />
                </Suspense>
              )}
            />
          ) : (
            <Route path="/agendamentomobile-teste" element={<Navigate to="/" replace />} />
          )}
        </>
      )}
      <Route path="/landingteste" element={<Navigate to="/" replace />} />
      <Route path="/landing2" element={<Navigate to="/" replace />} />
      <Route path="/landing3" element={<Navigate to="/siteteste" replace />} />
      <Route
        path="/siteteste"
        element={(
          <Suspense fallback={<TabLoadingFallback />}>
            <Landing3Page />
          </Suspense>
        )}
      />
      <Route path="/paginadevendas" element={<PaginadeVendasRoute />} />
      <Route path="/landingslootibarbers" element={<HomeLanding />} />
      <Route path="/:tenantSlug/*" element={<TenantShell />} />
      <Route
        path="/"
        element={(
          <Suspense fallback={<TabLoadingFallback />}>
            <SlootiSitePage />
          </Suspense>
        )}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
