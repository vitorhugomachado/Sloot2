import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { API_URL } from '../config/apiUrl';
import { useTenant } from './TenantContext';
import { getBootstrapQueryString, staffAppointmentsUrl } from '../utils/bookingHorizon';
import { fetchBootstrapJson, clearBootstrapInFlight } from '../utils/bootstrapInFlight';
import {
  shouldLeadAppointmentsPoll,
  releaseAppointmentsPollLeadership,
} from '../utils/appointmentsPollLeader';
import { notifyStaffNewOnlineAppointments } from '../utils/staffInAppNotifications';
import { mergeAppointmentsWithActivity, mergeAppointmentActivity } from '../utils/appointmentActivity';
import { todayIsoLocal } from '../utils/dateLocal';
import {
  readBootstrapFromCache,
  hasBootstrapCache,
  writeCache,
  clearClientDataCache,
} from '../utils/clientDataCache';
import {
  getStaffToken,
  setStaffToken as persistStaffToken,
  getCustomerToken,
  setCustomerToken as persistCustomerToken,
  setPendingCustomer,
  getPendingCustomer,
  clearPendingCustomer,
  isCustomerTokenForTenant,
} from '../utils/tenantAuthStorage';
import { isStaffRoutePath as isStaffRoutePathFromRoutes, tenantSlugFromPathname } from '../constants/tenantRoutes';

const AppContext = createContext();

const APPOINTMENTS_POLL_MS = Number(import.meta.env.VITE_APPOINTMENTS_POLL_MS) || 15000;
const BOOTSTRAP_TIMEOUT_MS = 10000;

function isStaffRoutePath(pathname) {
  return isStaffRoutePathFromRoutes(pathname);
}

function getInitialBootstrapState(slug) {
  const cached = readBootstrapFromCache(slug);
  return {
    barbers: Array.isArray(cached.barbers) ? cached.barbers : [],
    appointments: Array.isArray(cached.appointments) ? cached.appointments : [],
    services: Array.isArray(cached.services) ? cached.services : [],
    businessInfo: cached.businessInfo && typeof cached.businessInfo === 'object' ? cached.businessInfo : {},
  };
}

export const AppProvider = ({ children }) => {
  const { slug: tenantSlug, tenantHeaders, tenant, loading: tenantLoading } = useTenant();
  const location = useLocation();
  const initialBootstrap = getInitialBootstrapState(tenantSlug);
  const [barbers, setBarbers] = useState(initialBootstrap.barbers);
  const [appointments, setAppointments] = useState(initialBootstrap.appointments);
  const [services, setServices] = useState(initialBootstrap.services);
  const [businessInfo, setBusinessInfo] = useState(initialBootstrap.businessInfo);
  const [products, setProducts] = useState([]);
  const [productSales, setProductSales] = useState([]);
  const [bootstrapLoading, setBootstrapLoading] = useState(
    () => !hasBootstrapCache(tenantSlug) && !tenantLoading,
  );
  const [staffLoading, setStaffLoading] = useState(false);
  /** Compat: bloqueio de shell público = bootstrapLoading */
  const loading = bootstrapLoading;
  const [token, setToken] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [tenantModules, setTenantModules] = useState([]);

  const [customerToken, setCustomerToken] = useState(null);
  const [currentCustomer, setCurrentCustomer] = useState(null);

  /** Evita que respostas PUT fora de ordem sobrescrevam permissões mais recentes. */
  const barberPermissionsRequestSeq = useRef(new Map());
  const prevTenantSlugRef = useRef(tenantSlug);
  const inAppAppointmentTrackerRef = useRef({ initialized: false, knownIds: new Set() });

  const resolveAuthToken = useCallback(
    (authScope) => {
      const storedStaff = getStaffToken(tenantSlug, tenant?.id);
      const storedCustomer = getCustomerToken(tenantSlug, tenant?.id);

      if (authScope === 'staff') return token || storedStaff;
      if (authScope === 'customer') return customerToken || storedCustomer;
      return token || customerToken || storedStaff || storedCustomer;
    },
    [token, customerToken, tenantSlug, tenant?.id],
  );

  const staffLogoutRef = useRef(() => {});
  const customerLogoutRef = useRef(() => {});

  const apiFetch = useCallback(async (url, options = {}) => {
    const slugHeader = String(
      tenantHeaders['X-Tenant-Slug']
      || tenantSlug
      || (typeof window !== 'undefined' ? tenantSlugFromPathname(window.location.pathname) : '')
    ).trim().toLowerCase();

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (slugHeader) {
      headers['X-Tenant-Slug'] = slugHeader;
    }

    const authScope = options.authScope || 'auto';
    const activeToken = resolveAuthToken(authScope);

    if (activeToken) {
      headers['Authorization'] = `Bearer ${activeToken}`;
    }

    const { authScope: _authScope, signal, ...fetchOptions } = options;
    const res = await fetch(url, { ...fetchOptions, headers, signal });

    if (!options.skipLogout) {
      if (res.status === 401) {
        if (authScope === 'customer' && activeToken) customerLogoutRef.current();
        if (authScope === 'staff' && activeToken) staffLogoutRef.current();
      }
    }
    return res;
  }, [tenantHeaders, tenantSlug, resolveAuthToken]);

  const applyBootstrapData = useCallback((data) => {
    if (!data || typeof data !== 'object') return;
    if (Array.isArray(data.barbers)) {
      setBarbers(data.barbers);
      writeCache('barbers', data.barbers, tenantSlug);
    }
    if (Array.isArray(data.services)) {
      setServices(data.services);
      writeCache('services', data.services, tenantSlug);
    }
    if (data.business != null) {
      setBusinessInfo(data.business);
      writeCache('business', data.business, tenantSlug);
    }
    if (Array.isArray(data.appointments)) {
      setAppointments(data.appointments);
      writeCache('appointmentsPublic', data.appointments, tenantSlug);
    }
  }, [tenantSlug]);

  const loadPublicBootstrap = useCallback(async (signal) => {
    const qs = getBootstrapQueryString();
    const url = `${API_URL}/public/bootstrap?${qs}`;
    const slugHeader = String(
      tenantSlug
      || (typeof window !== 'undefined' ? tenantSlugFromPathname(window.location.pathname) : '')
    ).trim().toLowerCase();
    const headers = slugHeader ? { 'X-Tenant-Slug': slugHeader } : {};
    const timeout = new Promise((_, reject) => {
      const id = setTimeout(() => reject(new Error('Bootstrap timeout')), BOOTSTRAP_TIMEOUT_MS);
      signal?.addEventListener('abort', () => clearTimeout(id), { once: true });
    });
    const data = await Promise.race([
      fetchBootstrapJson(url, headers, tenantSlug),
      timeout,
    ]);
    if (signal?.aborted) return;
    applyBootstrapData(data);
  }, [tenantSlug, applyBootstrapData]);

  const hydrateFromCache = useCallback(() => {
    const cached = readBootstrapFromCache(tenantSlug);
    setBarbers(Array.isArray(cached.barbers) ? cached.barbers : []);
    setServices(Array.isArray(cached.services) ? cached.services : []);
    setAppointments(Array.isArray(cached.appointments) ? cached.appointments : []);
    setBusinessInfo(
      cached.businessInfo && typeof cached.businessInfo === 'object' ? cached.businessInfo : {},
    );
  }, [tenantSlug]);

  useEffect(() => {
    if (tenantLoading || !tenant) return undefined;

    const ac = new AbortController();
    const staffTok = getStaffToken(tenantSlug, tenant.id);
    const custTok = getCustomerToken(tenantSlug, tenant.id);
    const tenantSlugChanged = prevTenantSlugRef.current !== tenantSlug;
    prevTenantSlugRef.current = tenantSlug;
    if (tenantSlugChanged) {
      inAppAppointmentTrackerRef.current = { initialized: false, knownIds: new Set() };
    }

    setToken(staffTok);
    setCustomerToken((prev) => custTok || prev);
    if (!staffTok) {
      setCurrentUser(null);
      setTenantModules([]);
    }
    if (!custTok) {
      setCurrentCustomer((prev) => {
        if (tenantSlugChanged) return null;
        if (prev) return prev;
        return getPendingCustomer(tenantSlug);
      });
    }

    hydrateFromCache();
    setProducts([]);
    setProductSales([]);

    const hasCache = hasBootstrapCache(tenantSlug);
    if (hasCache) setBootstrapLoading(false);

    const runInit = async () => {
      try {
        await loadPublicBootstrap(ac.signal);
        if (ac.signal.aborted) return;

        if (staffTok) {
          setStaffLoading(true);
          try {
            const userRes = await apiFetch(`${API_URL}/auth/me`, {
              skipLogout: true,
              authScope: 'staff',
              signal: ac.signal,
            });
            if (ac.signal.aborted) return;
            if (userRes.ok) {
              const user = await userRes.json();
              setCurrentUser(user);
              setTenantModules(Array.isArray(user.tenantModules) ? user.tenantModules : []);

              const apptsRes = await apiFetch(staffAppointmentsUrl(API_URL), {
                authScope: 'staff',
                signal: ac.signal,
              });
              if (!ac.signal.aborted && apptsRes.ok) {
                setAppointments(await apptsRes.json());
              }

              void Promise.all([
                apiFetch(`${API_URL}/products`, { authScope: 'staff' }),
                apiFetch(`${API_URL}/sales`, { authScope: 'staff' }),
              ])
                .then(async ([prodsRes, salesRes]) => {
                  if (prodsRes.ok) setProducts(await prodsRes.json());
                  if (salesRes.ok) setProductSales(await salesRes.json());
                })
                .catch((err) => console.error('Erro ao carregar dados secundários:', err));
            } else if (!ac.signal.aborted) {
              persistStaffToken(tenantSlug, null);
              setToken(null);
              setCurrentUser(null);
              setTenantModules([]);
            }
          } catch (e) {
            if (!ac.signal.aborted) console.error('Auth error on reload:', e);
          } finally {
            if (!ac.signal.aborted) setStaffLoading(false);
          }
        }

        if (custTok && !ac.signal.aborted) {
          try {
            const custRes = await apiFetch(`${API_URL}/customer-auth/me`, {
              authScope: 'customer',
              skipLogout: true,
              signal: ac.signal,
            });
            if (!ac.signal.aborted) {
              if (custRes.ok) {
                const me = await custRes.json();
                setCurrentCustomer(me);
                clearPendingCustomer(tenantSlug);
              } else if (custRes.status === 401 || custRes.status === 403 || custRes.status === 404) {
                customerLogout();
              }
            }
          } catch (e) {
            if (!ac.signal.aborted) console.error('Customer auth error:', e);
          }
        }
      } catch (error) {
        if (!ac.signal.aborted) console.error('Error fetching data:', error);
      } finally {
        setBootstrapLoading(false);
      }
    };

    runInit();

    return () => {
      ac.abort();
      clearBootstrapInFlight(tenantSlug);
    };
  }, [tenantSlug, tenant?.id, tenantLoading]);

  useEffect(() => {
    if (!token || !isStaffRoutePath(location.pathname)) return undefined;

    const mergeAppointments = (data) => {
      setAppointments((prev) => mergeAppointmentsWithActivity(prev, data));
      notifyStaffNewOnlineAppointments(data, tenantSlug, inAppAppointmentTrackerRef.current);
    };

    const syncAppointments = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (!shouldLeadAppointmentsPoll(tenantSlug)) return;
      try {
        const apptsRes = await apiFetch(staffAppointmentsUrl(API_URL), { authScope: 'staff' });
        if (!apptsRes.ok) return;
        mergeAppointments(await apptsRes.json());
      } catch (error) {
        console.error('Error syncing appointments:', error);
      }
    };

    const intervalId = setInterval(syncAppointments, APPOINTMENTS_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') syncAppointments();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
      releaseAppointmentsPollLeadership(tenantSlug);
    };
  }, [token, tenantSlug, location.pathname]);

  const login = async (email, password) => {
    const slugHeader = String(
      tenantHeaders['X-Tenant-Slug']
      || tenantSlug
      || (typeof window !== 'undefined' ? tenantSlugFromPathname(window.location.pathname) : '')
    ).trim().toLowerCase();

    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(slugHeader ? { 'X-Tenant-Slug': slugHeader } : {}),
      },
      body: JSON.stringify({ email, password }),
    });
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Falha no login');
    }

    const { token: newToken, user } = await res.json();
    setToken(newToken);
    setCurrentUser(user);
    setTenantModules(Array.isArray(user.tenantModules) ? user.tenantModules : []);
    persistStaffToken(tenantSlug, newToken);
    return user;
  };

  const commitCustomerSession = useCallback((newToken, user) => {
    persistCustomerToken(tenantSlug, newToken);
    flushSync(() => {
      setCustomerToken(newToken);
      setCurrentCustomer(user);
    });
    setPendingCustomer(tenantSlug, user);
    return user;
  }, [tenantSlug]);

  const customerLogin = async (email, password) => {
    let res;
    try {
      res = await fetch(`${API_URL}/customer-auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...tenantHeaders },
        body: JSON.stringify({
          email: email != null ? String(email).trim().toLowerCase() : email,
          password,
        }),
      });
    } catch {
      throw new Error('Não foi possível contactar o servidor');
    }

    if (!res.ok) {
      let message = 'Falha no login';
      try {
        const error = await res.json();
        message = error.message || message;
      } catch {
        /* resposta não-JSON */
      }
      throw new Error(message);
    }

    let payload;
    try {
      payload = await res.json();
    } catch {
      throw new Error('Resposta inválida do servidor');
    }

    const { token: newToken, user } = payload;
    return commitCustomerSession(newToken, user);
  };

  const customerGoogleLogin = async (credential) => {
    let res;
    try {
      res = await fetch(`${API_URL}/customer-auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...tenantHeaders },
        body: JSON.stringify({ credential }),
      });
    } catch {
      throw new Error('Não foi possível contactar o servidor');
    }

    if (!res.ok) {
      let message = 'Falha no login com Google';
      try {
        const error = await res.json();
        message = error.message || message;
      } catch {
        /* resposta não-JSON */
      }
      throw new Error(message);
    }

    let payload;
    try {
      payload = await res.json();
    } catch {
      throw new Error('Resposta inválida do servidor');
    }

    const { token: newToken, user } = payload;
    return commitCustomerSession(newToken, user);
  };

  const customerRegister = async (data) => {
    const payload = {
      ...data,
      email: data.email != null ? String(data.email).trim().toLowerCase() : data.email,
    };
    const res = await fetch(`${API_URL}/customer-auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...tenantHeaders },
      body: JSON.stringify(payload),
    });
    
    if (!res.ok) {
      let message = 'Erro ao cadastrar';
      try {
        const error = await res.json();
        message = error.message || message;
      } catch {
        /* resposta não-JSON */
      }
      throw new Error(message);
    }

    const { token: newToken, user } = await res.json();
    return commitCustomerSession(newToken, user);
  };

  const getCustomerAppointments = async () => {
    const res = await apiFetch(`${API_URL}/customer-auth/appointments`, { authScope: 'customer' });
    if (res.ok) return res.json();
    throw new Error('Falha ao buscar histórico');
  };

  const updateCustomerProfile = async (data) => {
    const res = await apiFetch(`${API_URL}/customer-auth/profile`, {
      method: 'PATCH',
      authScope: 'customer',
      body: JSON.stringify(data)
    });
    if (res.ok) {
      const updated = await res.json();
      setCurrentCustomer(updated);
      return updated;
    }
    const err = await res.json();
    throw new Error(err.message || 'Falha ao atualizar perfil');
  };

  const customerLogout = () => {
    persistCustomerToken(tenantSlug, null);
    clearPendingCustomer(tenantSlug);
    setCustomerToken(null);
    setCurrentCustomer(null);
  };

  const syncNavigatedCustomer = useCallback((customer) => {
    if (customer) setCurrentCustomer((prev) => prev ?? customer);
  }, []);

  const refreshCurrentCustomer = useCallback(async () => {
    const active = getCustomerToken(tenantSlug, tenant?.id) || customerToken;
    if (!active) return null;

    setCustomerToken(active);
    try {
      const res = await apiFetch(`${API_URL}/customer-auth/me`, {
        authScope: 'customer',
        skipLogout: true,
      });
      if (res.ok) {
        const user = await res.json();
        setCurrentCustomer(user);
        clearPendingCustomer(tenantSlug);
        return user;
      }
      if (res.status === 401 || res.status === 403 || res.status === 404) customerLogout();
      return null;
    } catch (e) {
      console.error('Customer profile refresh error:', e);
      return null;
    }
  }, [tenantSlug, tenant?.id, customerToken]);

  const logout = () => {
    persistStaffToken(tenantSlug, null);
    setToken(null);
    setCurrentUser(null);
    setTenantModules([]);
    void loadPublicBootstrap();
  };

  staffLogoutRef.current = logout;
  customerLogoutRef.current = customerLogout;

  const updateBusinessInfo = async (newData) => {
    try {
      const res = await apiFetch(`${API_URL}/business`, {
        method: 'PUT',
        authScope: 'staff',
        body: JSON.stringify(newData)
      });
      if (res.ok) {
        const updated = await res.json();
        setBusinessInfo(updated);
        clearClientDataCache(tenantSlug);
        writeCache('business', updated, tenantSlug);
        return updated;
      }
      const err = await res.json();
      const msg = err.details ? `${err.message || 'Erro'} — ${err.details}` : err.message;
      throw new Error(msg || 'Falha ao atualizar informações do negócio');
    } catch (error) {
      console.error("Error updating business info:", error);
      throw error;
    }
  };

  const addAppointment = async (newApp) => {
    try {
      const authScope = customerToken ? 'customer' : 'staff';
      const res = await apiFetch(`${API_URL}/appointments`, {
        method: 'POST',
        authScope,
        body: JSON.stringify(newApp),
      });

      if (res.ok) {
        const savedApp = await res.json();

        setAppointments((prev) => [
          ...prev,
          mergeAppointmentActivity(undefined, savedApp),
        ]);

        if (token) {
          apiFetch(staffAppointmentsUrl(API_URL), { authScope: 'staff' })
            .then(async (r) => {
              if (r.ok) {
                const data = await r.json();
                if (Array.isArray(data)) {
                  setAppointments((prev) => {
                    const merged = mergeAppointmentsWithActivity(prev, data);
                    const fetchedIds = new Set(data.map((a) => Number(a.id)));
                    const extras = prev.filter((a) => !fetchedIds.has(Number(a.id)));
                    return [...merged, ...extras];
                  });
                }
              }
            })
            .catch((err) => console.error('Erro ao sincronizar agendamentos:', err));
        } else {
          fetch(`${API_URL}/appointments/public?${getBootstrapQueryString()}`, { headers: tenantHeaders })
            .then(async (r) => {
              if (r.ok) {
                const data = await r.json();
                if (Array.isArray(data)) {
                  setAppointments(data);
                  writeCache('appointmentsPublic', data, tenantSlug);
                }
              }
            })
            .catch((err) => console.error('Erro ao sincronizar horários públicos:', err));
        }

        return { ok: true, appointment: savedApp };
      }

      const err = await res.json().catch(() => ({}));
      return { ok: false, message: err.message || 'Erro desconhecido' };
    } catch (error) {
      console.error('Add appointment error:', error);
      return { ok: false, message: 'Falha de conexão ao tentar salvar o agendamento.' };
    }
  };

  const updateAppointmentStatus = async (id, status, extraData = {}, authScope = 'staff') => {
    try {
      const res = await apiFetch(`${API_URL}/appointments/${id}`, {
        method: 'PATCH',
        authScope,
        body: JSON.stringify({ status, ...extraData })
      });
      if (res.ok) {
          const updatedApp = await res.json();
          setAppointments(prev => prev.map(app => app.id === id ? { ...updatedApp, _updatedAtLocal: Date.now() } : app));
          return true;
      } else {
          const err = await res.json().catch(() => ({}));
          if (err.code === 'CASH_CLOSED' || err.code === 'CASH_REQUIRED' || /caixa/i.test(err.message || '')) {
            const go = window.confirm(
              `${err.message || 'Selecione ou abra o caixa do dia antes de confirmar o recebimento.'}\n\nAbrir o Financeiro agora?`,
            );
            if (go && tenantSlug) {
              window.location.assign(`/${tenantSlug}/dashboard/financeiro`);
            }
          } else {
            alert(`Erro ao atualizar agendamento: ${err.message || 'desconhecido'}`);
          }
          return false;
      }
    } catch (error) {
      alert("Erro de conexão ao atualizar agendamento.");
      return false;
    }
  };

  const cancelAppointment = async (id) => {
    return updateAppointmentStatus(id, 'Cancelado');
  };

  const customerUpdateAppointmentStatus = async (id, status, extraData = {}) => {
    return updateAppointmentStatus(id, status, extraData, 'customer');
  };

  const customerCancelAppointment = async (id) => {
    return customerUpdateAppointmentStatus(id, 'Cancelado');
  };

  const customerRateAppointment = async (id, rating) => {
    const res = await apiFetch(`${API_URL}/appointments/${id}`, {
      method: 'PATCH',
      authScope: 'customer',
      body: JSON.stringify({ customer_rating: rating }),
    });
    if (res.ok) return res.json();
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Não foi possível guardar a avaliação.');
  };

  const addBarber = async (newBarber) => {
    try {
      const payload = { ...newBarber, status: 'Ativo', permissions: ['scheduler', 'clients'] };
      const res = await apiFetch(`${API_URL}/barbers`, {
        method: 'POST',
        authScope: 'staff',
        body: JSON.stringify(payload)
      });
      if (res.ok) {
          const savedBarber = await res.json();
          setBarbers(prev => [...prev, savedBarber]);
          alert("Profissional cadastrado com sucesso!");
          return true;
      } else {
          const errorData = await res.json().catch(() => ({}));
          const extra = errorData.details ? ` — ${errorData.details}` : '';
          const base = errorData.message || res.statusText || `HTTP ${res.status}`;
          alert(`Erro ao cadastrar profissional: ${base}${extra}`);
          return false;
      }
    } catch (e) {
      alert("Erro na conexão com o servidor ao cadastrar profissional.");
      return false;
    }
  };

  const updateBarberPermissions = async (id, permissions) => {
    const key = Number(id);
    const seq = (barberPermissionsRequestSeq.current.get(key) ?? 0) + 1;
    barberPermissionsRequestSeq.current.set(key, seq);

    const res = await apiFetch(`${API_URL}/barbers/${id}`, {
      method: 'PUT',
      authScope: 'staff',
      body: JSON.stringify({ permissions })
    });
    if (res.ok) {
        const updatedBarber = await res.json();
        if (barberPermissionsRequestSeq.current.get(key) !== seq) return;
        setBarbers(prev => prev.map(b => b.id === id ? updatedBarber : b));
    }
  };

  const removeBarber = async (id) => {
    const res = await apiFetch(`${API_URL}/barbers/${id}`, { method: 'DELETE', authScope: 'staff' });
    if (res.ok) setBarbers(prev => prev.filter(b => b.id !== id));
  };

  const mergeBarberScheduleBlocks = (barberId, blocks) => {
    const nid = Number(barberId);
    setBarbers((prev) =>
      prev.map((b) => (Number(b.id) === nid ? { ...b, scheduleBlocks: blocks } : b))
    );
  };

  const fetchBarberScheduleBlocks = async (barberId) => {
    try {
      const res = await apiFetch(`${API_URL}/barbers/${barberId}/schedule-blocks`, {
        authScope: 'staff',
      });
      if (!res.ok) return [];
      const blocks = await res.json();
      mergeBarberScheduleBlocks(barberId, blocks);
      return blocks;
    } catch {
      return [];
    }
  };

  const createBarberScheduleBlock = async (barberId, data) => {
    const res = await apiFetch(`${API_URL}/barbers/${barberId}/schedule-blocks`, {
      method: 'POST',
      authScope: 'staff',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.message || 'Erro ao bloquear horário.');
      return null;
    }
    const block = await res.json();
    await fetchBarberScheduleBlocks(barberId);
    return block;
  };

  const deleteBarberScheduleBlock = async (barberId, blockId) => {
    const res = await apiFetch(`${API_URL}/barbers/${barberId}/schedule-blocks/${blockId}`, {
      method: 'DELETE',
      authScope: 'staff',
    });
    if (res.ok) await fetchBarberScheduleBlocks(barberId);
    else alert('Não foi possível remover o bloqueio.');
    return res.ok;
  };

  const updateBarber = async (id, data) => {
    let body;
    try {
      body = JSON.stringify(data);
    } catch (e) {
      console.error('updateBarber JSON:', e);
      alert(`Erro ao preparar dados: ${e.message || String(e)}`);
      return false;
    }
    const res = await apiFetch(`${API_URL}/barbers/${id}`, {
      method: 'PUT',
      authScope: 'staff',
      body,
    });
    if (res.ok) {
      const updatedBarber = await res.json();
      const nid = Number(id);
      setBarbers((prev) => prev.map((b) => (Number(b.id) === nid ? updatedBarber : b)));
      return true;
    }
    const err = await res.json().catch(() => ({}));
    const extra = err.details ? ` — ${err.details}` : '';
    alert(`Erro ao atualizar profissional: ${err.message || res.statusText || res.status}${extra}`);
    return false;
  };
  
  const toggleBarberStatus = async (id) => {
    const nid = Number(id);
    const barber = barbers.find((b) => Number(b.id) === nid);
    if (!barber) {
      alert('Usuário não encontrado.');
      return null;
    }
    const newStatus = barber.status === 'Ativo' ? 'Suspenso' : 'Ativo';
    const res = await apiFetch(`${API_URL}/barbers/${id}`, {
      method: 'PUT',
      authScope: 'staff',
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      const updatedBarber = await res.json();
      setBarbers((prev) => prev.map((b) => (Number(b.id) === nid ? updatedBarber : b)));
      return updatedBarber;
    }
    const err = await res.json().catch(() => ({}));
    alert(err.message || 'Não foi possível alterar o status do usuário.');
    return null;
  };

  const addService = async (newService) => {
    const res = await apiFetch(`${API_URL}/services`, {
      method: 'POST',
      body: JSON.stringify(newService)
    });
    if (res.ok) {
        const savedService = await res.json();
        setServices((prev) => {
          const next = [...prev, savedService];
          clearClientDataCache(tenantSlug);
          writeCache('services', next, tenantSlug);
          return next;
        });
    }
  };

  const removeService = async (id) => {
    const res = await apiFetch(`${API_URL}/services/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setServices((prev) => {
        const next = prev.filter(s => s.id !== id);
        clearClientDataCache(tenantSlug);
        writeCache('services', next, tenantSlug);
        return next;
      });
    }
  };

  const updateService = async (id, data) => {
    const res = await apiFetch(`${API_URL}/services/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    if (res.ok) {
        const updated = await res.json();
        setServices((prev) => {
          const next = prev.map(s => s.id === id ? updated : s);
          clearClientDataCache(tenantSlug);
          writeCache('services', next, tenantSlug);
          return next;
        });
    }
  };

  const addProduct = async (newProduct) => {
    const res = await apiFetch(`${API_URL}/products`, {
      method: 'POST',
      body: JSON.stringify(newProduct)
    });
    if (res.ok) {
        const savedProduct = await res.json();
        setProducts(prev => [...prev, savedProduct]);
    }
  };

  const removeProduct = async (id) => {
    const res = await apiFetch(`${API_URL}/products/${id}`, { method: 'DELETE' });
    if (res.ok) setProducts(prev => prev.filter(p => p.id !== id));
  };

  const updateProduct = async (id, data) => {
    const res = await apiFetch(`${API_URL}/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    if (res.ok) {
        const updated = await res.json();
        setProducts(prev => prev.map(p => p.id === id ? updated : p));
    }
  };

  /** Entrada de estoque (somar unidades). Apenas API aceita Gerente. */
  const adjustProductStock = async (productId, delta) => {
    const res = await apiFetch(`${API_URL}/products/${productId}/stock`, {
      method: 'PATCH',
      body: JSON.stringify({ delta }),
      authScope: 'staff',
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, message: body.message || 'Falha ao registar entrada no estoque.' };
    }
    setProducts((prev) => prev.map((p) => (p.id === productId ? body : p)));
    return { ok: true };
  };

  const sellProduct = async (productId, quantity = 1, barberId = null, saleMeta = {}) => {
    const product = products.find(p => p.id === productId);
    if (!product || product.stock < quantity) return false;

    const { customerId = null, customerName = null } = saleMeta;

    await apiFetch(`${API_URL}/products/${productId}`, {
      method: 'PUT',
      body: JSON.stringify({ stock: product.stock - quantity })
    });
    
    const saleRes = await apiFetch(`${API_URL}/sales`, {
      method: 'POST',
      body: JSON.stringify({
        productId,
        productName: product.name,
        price: product.price,
        cost: product.cost,
        quantity,
        date: saleMeta.saleDate || todayIsoLocal(),
        barberId: barberId || null,
        customerId: customerId ? Number(customerId) : null,
        customerName: customerName?.trim() || null,
      })
    });
    
    if (saleRes.ok) {
        const savedSale = await saleRes.json();
        setProducts(prev => prev.map(p => p.id === productId ? { ...p, stock: p.stock - quantity } : p));
        setProductSales(prev => [...prev, savedSale]);
        return true;
    }
    return false;
  };

  const refreshStaffAppointments = useCallback(async () => {
    if (!token) return;
    try {
      const apptsRes = await apiFetch(staffAppointmentsUrl(API_URL), { authScope: 'staff' });
      if (!apptsRes.ok) return;
      const data = await apptsRes.json();
      setAppointments((prev) => mergeAppointmentsWithActivity(prev, data));
      notifyStaffNewOnlineAppointments(data, tenantSlug, inAppAppointmentTrackerRef.current);
    } catch (error) {
      console.error('Error refreshing appointments:', error);
    }
  }, [token, apiFetch, tenantSlug]);

  const financeV2 = useMemo(() => ({
    getCurrentCash: async () => {
      const res = await apiFetch(`${API_URL}/cash/current`, { authScope: 'staff' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Erro ao buscar caixa');
      return body;
    },
    listCashSessions: async () => {
      const res = await apiFetch(`${API_URL}/cash/sessions`, { authScope: 'staff' });
      return res.ok ? res.json() : [];
    },
    getCashSession: async (id) => {
      const res = await apiFetch(`${API_URL}/cash/sessions/${id}`, { authScope: 'staff' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Erro ao buscar sessão');
      return body;
    },
    openCash: async (payload) => {
      const res = await apiFetch(`${API_URL}/cash/open`, {
        method: 'POST',
        authScope: 'staff',
        body: JSON.stringify(payload || {}),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(body.error || 'Erro ao abrir caixa');
        err.code = body.code;
        err.status = res.status;
        throw err;
      }
      return body;
    },
    reopenCash: async (id, payload = {}) => {
      const res = await apiFetch(`${API_URL}/cash/sessions/${id}/reopen`, {
        method: 'POST',
        authScope: 'staff',
        body: JSON.stringify(payload || {}),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(body.error || 'Erro ao reabrir caixa');
        err.code = body.code;
        err.status = res.status;
        err.body = body;
        throw err;
      }
      return body;
    },
    closeCash: async (payload) => {
      const res = await apiFetch(`${API_URL}/cash/close`, {
        method: 'POST',
        authScope: 'staff',
        body: JSON.stringify(payload || {}),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(body.error || 'Erro ao fechar caixa');
        err.code = body.code;
        err.status = res.status;
        err.body = body;
        throw err;
      }
      return body;
    },
    createCashMovement: async (payload) => {
      const res = await apiFetch(`${API_URL}/cash/movements`, {
        method: 'POST',
        authScope: 'staff',
        body: JSON.stringify(payload || {}),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Erro ao lançar movimento');
      return body;
    },
    listComandas: async (params = {}) => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v != null && v !== '') qs.set(k, v);
      });
      const res = await apiFetch(`${API_URL}/comandas?${qs}`, { authScope: 'staff' });
      return res.ok ? res.json() : [];
    },
    createComanda: async (payload) => {
      const res = await apiFetch(`${API_URL}/comandas`, {
        method: 'POST',
        authScope: 'staff',
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Erro ao criar comanda');
      return body;
    },
    updateComandaItems: async (id, payload) => {
      const res = await apiFetch(`${API_URL}/comandas/${id}/items`, {
        method: 'PUT',
        authScope: 'staff',
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Erro ao atualizar itens');
      return body;
    },
    createDirectSale: async (payload) => {
      const res = await apiFetch(`${API_URL}/comandas/direct-sale`, {
        method: 'POST',
        authScope: 'staff',
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(body.error || 'Erro na venda avulsa');
        err.code = body.code;
        err.status = res.status;
        throw err;
      }
      await refreshStaffAppointments();
      return body;
    },
    settleComanda: async (id, payments) => {
      const res = await apiFetch(`${API_URL}/comandas/${id}/settle`, {
        method: 'POST',
        authScope: 'staff',
        body: JSON.stringify({
          payments,
          cashSessionId: payments?.cashSessionId,
          discountAmount: payments?.discountAmount,
          tipAmount: payments?.tipAmount,
          allowPartial: payments?.allowPartial,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(body.error || 'Erro ao quitar comanda');
        err.code = body.code;
        err.status = res.status;
        throw err;
      }
      await refreshStaffAppointments();
      return body;
    },
    reverseComanda: async (id, payload = {}) => {
      const res = await apiFetch(`${API_URL}/comandas/${id}/reverse`, {
        method: 'POST',
        authScope: 'staff',
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Erro ao estornar comanda');
      await refreshStaffAppointments();
      return body;
    },
    cancelComanda: async (id) => {
      const res = await apiFetch(`${API_URL}/comandas/${id}/cancel`, {
        method: 'POST',
        authScope: 'staff',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Erro ao cancelar');
      return body;
    },
    listCategories: async () => {
      const res = await apiFetch(`${API_URL}/finance-v2/categories`, { authScope: 'staff' });
      return res.ok ? res.json() : [];
    },
    createCategory: async (payload) => {
      const res = await apiFetch(`${API_URL}/finance-v2/categories`, {
        method: 'POST',
        authScope: 'staff',
        body: JSON.stringify(payload || {}),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Erro ao criar categoria');
      return body;
    },
    updateCategory: async (id, payload) => {
      const res = await apiFetch(`${API_URL}/finance-v2/categories/${id}`, {
        method: 'PUT',
        authScope: 'staff',
        body: JSON.stringify(payload || {}),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Erro ao atualizar categoria');
      return body;
    },
    deleteCategory: async (id) => {
      const res = await apiFetch(`${API_URL}/finance-v2/categories/${id}`, {
        method: 'DELETE',
        authScope: 'staff',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(body.error || 'Erro ao excluir categoria');
        err.code = body.code;
        err.status = res.status;
        throw err;
      }
      return body;
    },
    listExpenses: async (params = {}) => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v != null && v !== '') qs.set(k, v);
      });
      const res = await apiFetch(`${API_URL}/finance-v2/expenses?${qs}`, { authScope: 'staff' });
      return res.ok ? res.json() : [];
    },
    createExpense: async (payload) => {
      const res = await apiFetch(`${API_URL}/finance-v2/expenses`, {
        method: 'POST',
        authScope: 'staff',
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(body.error || 'Erro ao criar despesa');
        err.code = body.code;
        throw err;
      }
      return body;
    },
    updateExpense: async (id, payload) => {
      const res = await apiFetch(`${API_URL}/finance-v2/expenses/${id}`, {
        method: 'PUT',
        authScope: 'staff',
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Erro ao atualizar');
      return body;
    },
    payExpense: async (id, payload = {}) => {
      const res = await apiFetch(`${API_URL}/finance-v2/expenses/${id}/pay`, {
        method: 'POST',
        authScope: 'staff',
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(body.error || 'Erro ao pagar despesa');
        err.code = body.code;
        err.status = res.status;
        throw err;
      }
      return body;
    },
    reverseExpense: async (id) => {
      const res = await apiFetch(`${API_URL}/finance-v2/expenses/${id}/reverse`, {
        method: 'POST',
        authScope: 'staff',
        body: JSON.stringify({}),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Erro ao estornar despesa');
      return body;
    },
    getComanda: async (id) => {
      const res = await apiFetch(`${API_URL}/comandas/${id}`, { authScope: 'staff' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Erro ao buscar comanda');
      return body;
    },
    deleteExpense: async (id) => {
      const res = await apiFetch(`${API_URL}/finance-v2/expenses/${id}`, {
        method: 'DELETE',
        authScope: 'staff',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const err = new Error(body.error || 'Erro ao excluir');
        err.code = body.code;
        throw err;
      }
      return true;
    },
    getLedger: async (params = {}) => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v != null && v !== '') qs.set(k, v);
      });
      const res = await apiFetch(`${API_URL}/finance-v2/ledger?${qs}`, { authScope: 'staff' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Erro no extrato');
      return body;
    },
    getCashFlow: async (params = {}) => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v != null && v !== '') qs.set(k, v);
      });
      const res = await apiFetch(`${API_URL}/finance-v2/cash-flow?${qs}`, { authScope: 'staff' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Erro no fluxo');
      return body;
    },
    getCommissions: async (params = {}) => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v != null && v !== '') qs.set(k, v);
      });
      const res = await apiFetch(`${API_URL}/finance-v2/commissions?${qs}`, { authScope: 'staff' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Erro nas comissões');
      return body;
    },
    listCommissionPayouts: async (params = {}) => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v != null && v !== '') qs.set(k, v);
      });
      const res = await apiFetch(`${API_URL}/finance-v2/commissions/payouts?${qs}`, { authScope: 'staff' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Erro ao listar pagamentos de comissão');
      return body;
    },
    createCommissionPayout: async (payload) => {
      const res = await apiFetch(`${API_URL}/finance-v2/commissions/payouts`, {
        method: 'POST',
        authScope: 'staff',
        body: JSON.stringify(payload || {}),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(body.error || 'Erro ao pagar comissão');
        err.code = body.code;
        err.status = res.status;
        throw err;
      }
      return body;
    },
    getAccountBalances: async () => {
      const res = await apiFetch(`${API_URL}/finance-v2/accounts/balances`, { authScope: 'staff' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Erro ao buscar saldos');
      return body;
    },
    transferAccounts: async (payload) => {
      const res = await apiFetch(`${API_URL}/finance-v2/accounts/transfer`, {
        method: 'POST',
        authScope: 'staff',
        body: JSON.stringify(payload || {}),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(body.error || 'Erro na transferência');
        err.code = body.code;
        err.status = res.status;
        throw err;
      }
      return body;
    },
    listClosings: async () => {
      const res = await apiFetch(`${API_URL}/finance-v2/closings`, { authScope: 'staff' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Erro ao listar fechamentos');
      return Array.isArray(body) ? body : [];
    },
    createClosing: async (payload) => {
      const res = await apiFetch(`${API_URL}/finance-v2/closings`, {
        method: 'POST',
        authScope: 'staff',
        body: JSON.stringify(payload || {}),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(body.error || 'Erro ao fechar período');
        err.code = body.code;
        err.status = res.status;
        throw err;
      }
      return body;
    },
    getDre: async (params = {}) => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v != null && v !== '') qs.set(k, v);
      });
      const res = await apiFetch(`${API_URL}/finance-v2/dre?${qs}`, { authScope: 'staff' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Erro ao gerar DRE');
      return body;
    },
    getAuditLog: async (params = {}) => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v != null && v !== '') qs.set(k, v);
      });
      const res = await apiFetch(`${API_URL}/finance-v2/audit?${qs}`, { authScope: 'staff' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Erro ao buscar auditoria');
      return Array.isArray(body) ? body : [];
    },
    getKpis: async (params = {}) => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v != null && v !== '') qs.set(k, v);
      });
      const res = await apiFetch(`${API_URL}/finance-v2/kpis?${qs}`, { authScope: 'staff' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Erro ao buscar KPIs');
      return body;
    },
    listCardFees: async () => {
      const res = await apiFetch(`${API_URL}/finance-v2/card-fees`, { authScope: 'staff' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Erro ao listar taxas de cartão');
      return body;
    },
    upsertCardFee: async (payload) => {
      const res = await apiFetch(`${API_URL}/finance-v2/card-fees`, {
        method: 'PUT',
        authScope: 'staff',
        body: JSON.stringify(payload || {}),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Erro ao salvar taxa de cartão');
      return body;
    },
  }), [apiFetch, refreshStaffAppointments]);

  const storedCustomerToken = getCustomerToken(tenantSlug, tenant?.id);
  const customerSessionActive =
    !!currentCustomer
    || !!storedCustomerToken
    || isCustomerTokenForTenant(customerToken, tenant?.id)
    || !!getPendingCustomer(tenantSlug);

  return (
    <AppContext.Provider value={{
      barbers, appointments, services, businessInfo, products, productSales,
      addAppointment, updateAppointmentStatus, cancelAppointment,
      addBarber, updateBarberPermissions, removeBarber, updateBarber, toggleBarberStatus,
      fetchBarberScheduleBlocks, createBarberScheduleBlock, deleteBarberScheduleBlock,
      addService, removeService, updateService,
      addProduct, removeProduct, updateProduct, adjustProductStock,
      sellProduct, updateBusinessInfo,
      refreshStaffAppointments,
      financeV2,
      login, logout, currentUser, tenantModules, token, tenantSlug, apiFetch, loading, bootstrapLoading, staffLoading,
      currentCustomer, isCustomerAuthenticated: customerSessionActive, customerLogin, customerGoogleLogin, customerRegister, customerLogout, refreshCurrentCustomer, syncNavigatedCustomer,
      getCustomerAppointments, updateCustomerProfile,
      customerUpdateAppointmentStatus, customerCancelAppointment,
      customerRateAppointment,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
