import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { API_URL } from '../config/apiUrl';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [barbers, setBarbers] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [services, setServices] = useState([]);
  const [businessInfo, setBusinessInfo] = useState({});
  const [products, setProducts] = useState([]);
  const [productSales, setProductSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [monthClosings, setMonthClosings] = useState([]);
  const [periodClosings, setPeriodClosings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('barberpro_token'));
  const [currentUser, setCurrentUser] = useState(null);
  
  const [customerToken, setCustomerToken] = useState(localStorage.getItem('barberpro_customer_token'));
  const [currentCustomer, setCurrentCustomer] = useState(null);

  /** Evita que respostas PUT fora de ordem sobrescrevam permissões mais recentes. */
  const barberPermissionsRequestSeq = useRef(new Map());

  const apiFetch = async (url, options = {}) => {
    const headers = { 
      'Content-Type': 'application/json',
      ...options.headers 
    };

    const authScope = options.authScope || 'auto';
    let activeToken = null;

    if (authScope === 'staff') activeToken = token;
    else if (authScope === 'customer') activeToken = customerToken;
    else if (authScope === 'auto') activeToken = token || customerToken;

    if (activeToken) {
      headers['Authorization'] = `Bearer ${activeToken}`;
    }

    const { authScope: _authScope, ...fetchOptions } = options;
    const res = await fetch(url, { ...fetchOptions, headers });
    
    if (res.status === 401 && !options.skipLogout) {
      if (authScope === 'customer' && customerToken) customerLogout();
      if (authScope === 'staff' && token) logout();
    }
    return res;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [barbersRes, servicesRes, businessRes] = await Promise.all([
          apiFetch(`${API_URL}/barbers`, { authScope: 'staff' }),
          fetch(`${API_URL}/services`),
          fetch(`${API_URL}/business`)
        ]);

        if (barbersRes.ok) setBarbers(await barbersRes.json());
        if (servicesRes.ok) setServices(await servicesRes.json());
        if (businessRes.ok) setBusinessInfo(await businessRes.json());

        
        if (token) {
           try {
             // Explicitly skip logout on this fetch if it's the first attempt
             const userRes = await apiFetch(`${API_URL}/auth/me`, { skipLogout: true, authScope: 'staff' });
             if (userRes.ok) {
               const user = await userRes.json();
               setCurrentUser(user);
               
               // Dados críticos primeiro (agenda/dashboard); resto em background
               const apptsRes = await apiFetch(`${API_URL}/appointments`, { authScope: 'staff' });
               if (apptsRes.ok) {
                 setAppointments(await apptsRes.json());
               }

               void Promise.all([
                 apiFetch(`${API_URL}/products`, { authScope: 'staff' }),
                 apiFetch(`${API_URL}/sales`, { authScope: 'staff' }),
                 apiFetch(`${API_URL}/expenses`, { authScope: 'staff' }),
                 apiFetch(`${API_URL}/month-closings`, { authScope: 'staff' }),
                 apiFetch(`${API_URL}/period-closings`, { authScope: 'staff' }),
               ]).then(async ([prodsRes, salesRes, expensesRes, closingsRes, periodCloseRes]) => {
                 if (prodsRes.ok) setProducts(await prodsRes.json());
                 if (salesRes.ok) setProductSales(await salesRes.json());
                 if (expensesRes.ok) setExpenses(await expensesRes.json());
                 if (closingsRes.ok) setMonthClosings(await closingsRes.json());
                 if (periodCloseRes.ok) setPeriodClosings(await periodCloseRes.json());
               }).catch((err) => console.error('Erro ao carregar dados secundários:', err));
             } else {
               logout();
             }
           } catch(e) {
             console.error("Auth error on reload:", e);
           }
         } else {
           try {
             const pubRes = await fetch(`${API_URL}/appointments/public`);
             if (pubRes.ok) {
               const pubData = await pubRes.json();
               if (Array.isArray(pubData)) setAppointments(pubData);
             }
           } catch (e) {
             console.error('Erro ao carregar horários ocupados (público):', e);
           }
         }

        if (customerToken) {
          try {
            const custRes = await apiFetch(`${API_URL}/customer-auth/me`, { authScope: 'customer' });
            if (custRes.ok) {
              setCurrentCustomer(await custRes.json());
            } else {
              customerLogout();
            }
          } catch(e) {
            console.error("Customer auth error:", e);
          }
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token, customerToken]);

  useEffect(() => {
    if (!token) return;

    const syncAppointments = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      try {
        const apptsRes = await apiFetch(`${API_URL}/appointments`, { authScope: 'staff' });
        if (!apptsRes.ok) return;
        const data = await apptsRes.json();
        if (Array.isArray(data)) {
          setAppointments(prev => {
            const prevMap = new Map(prev.map(app => [Number(app.id), app]));
            return data.map(app => {
              const oldApp = prevMap.get(Number(app.id));
              if (!oldApp) return app;
              const statusChanged = oldApp.status !== app.status;
              if (statusChanged) {
                return { ...app, _updatedAtLocal: Date.now() };
              }
              if (oldApp._updatedAtLocal) {
                return { ...app, _updatedAtLocal: oldApp._updatedAtLocal };
              }
              return app;
            });
          });
        }
      } catch (error) {
        console.error('Error syncing appointments:', error);
      }
    };

    const intervalId = setInterval(syncAppointments, 15000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') syncAppointments();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [token]);

  const login = async (email, password) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Falha no login');
    }

    const { token: newToken, user } = await res.json();
    setToken(newToken);
    setCurrentUser(user);
    localStorage.setItem('barberpro_token', newToken);
    return user;
  };

  const customerLogin = async (email, password) => {
    const res = await fetch(`${API_URL}/customer-auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email != null ? String(email).trim().toLowerCase() : email,
        password,
      })
    });
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Falha no login');
    }

    const { token: newToken, user } = await res.json();
    localStorage.setItem('barberpro_customer_token', newToken);
    setCustomerToken(newToken);
    setCurrentCustomer(user);
    return user;
  };

  const customerGoogleLogin = async (credential) => {
    const res = await fetch(`${API_URL}/customer-auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential })
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Falha no login com Google');
    }

    const { token: newToken, user } = await res.json();
    localStorage.setItem('barberpro_customer_token', newToken);
    setCustomerToken(newToken);
    setCurrentCustomer(user);
    return user;
  };

  const customerRegister = async (data) => {
    const payload = {
      ...data,
      email: data.email != null ? String(data.email).trim().toLowerCase() : data.email,
    };
    const res = await fetch(`${API_URL}/customer-auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
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
    localStorage.setItem('barberpro_customer_token', newToken);
    setCustomerToken(newToken);
    setCurrentCustomer(user);
    return user;
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
    localStorage.removeItem('barberpro_customer_token');
    setCustomerToken(null);
    setCurrentCustomer(null);
  };

  const logout = () => {
    setToken(null);
    setCurrentUser(null);
    localStorage.removeItem('barberpro_token');
  };

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

        setAppointments((prev) => [...prev, savedApp]);

        if (token) {
          apiFetch(`${API_URL}/appointments`, { authScope: 'staff' })
            .then(async (r) => {
              if (r.ok) {
                const data = await r.json();
                if (Array.isArray(data)) setAppointments(data);
              }
            })
            .catch((err) => console.error('Erro ao sincronizar agendamentos:', err));
        } else {
          fetch(`${API_URL}/appointments/public`)
            .then(async (r) => {
              if (r.ok) {
                const data = await r.json();
                if (Array.isArray(data)) setAppointments(data);
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
          const err = await res.json();
          alert(`Erro ao atualizar agendamento: ${err.message}`);
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
        setServices(prev => [...prev, savedService]);
    }
  };

  const removeService = async (id) => {
    const res = await apiFetch(`${API_URL}/services/${id}`, { method: 'DELETE' });
    if (res.ok) setServices(prev => prev.filter(s => s.id !== id));
  };

  const updateService = async (id, data) => {
    const res = await apiFetch(`${API_URL}/services/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    if (res.ok) {
        const updated = await res.json();
        setServices(prev => prev.map(s => s.id === id ? updated : s));
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

  const sellProduct = async (productId, quantity = 1, barberId = null) => {
    const product = products.find(p => p.id === productId);
    if (!product || product.stock < quantity) return false;
    
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
        date: new Date().toISOString().split('T')[0],
        barberId: barberId || null
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

  const addExpense = async (newExpense) => {
    const res = await apiFetch(`${API_URL}/expenses`, {
      method: 'POST',
      body: JSON.stringify(newExpense)
    });
    if (res.ok) {
        const savedExpense = await res.json();
        setExpenses(prev => [...prev, savedExpense]);
    }
  };

  const removeExpense = async (id) => {
    const res = await apiFetch(`${API_URL}/expenses/${id}`, { method: 'DELETE' });
    if (res.ok) setExpenses(prev => prev.filter(e => e.id !== id));
  };

  const updateExpense = async (id, data) => {
    const res = await apiFetch(`${API_URL}/expenses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    if (res.ok) {
        const updated = await res.json();
        setExpenses(prev => prev.map(e => e.id === id ? updated : e));
    }
  };

  const refreshPeriodClosings = async () => {
    if (!token) return;
    const res = await apiFetch(`${API_URL}/period-closings`, { authScope: 'staff' });
    if (res.ok) {
      setPeriodClosings(await res.json());
    }
  };

  const createPeriodClosing = async ({ startDate, endDate, scope, barberId, notes }) => {
    const payload = {
      startDate,
      endDate,
      scope,
      notes: notes || '',
    };
    if (scope === 'BARBER' && barberId != null && barberId !== '') {
      payload.barberId = Number(barberId);
    }
    const res = await apiFetch(`${API_URL}/period-closings`, {
      method: 'POST',
      authScope: 'staff',
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const base = body.error || body.message || 'Falha ao registar fechamento';
      const detail = body.details ? ` ${body.details}` : '';
      const err = new Error(`${base}${detail}`.trim());
      err.status = res.status;
      throw err;
    }
    setPeriodClosings((prev) => {
      const id = body?.id;
      const without = id == null ? prev : prev.filter((row) => row.id !== id);
      return [body, ...without];
    });
    return body;
  };

  const refreshMonthClosings = async () => {
    if (!token) return;
    const res = await apiFetch(`${API_URL}/month-closings`, { authScope: 'staff' });
    if (res.ok) setMonthClosings(await res.json());
  };

  const createMonthClosing = async ({ yearMonth, notes }) => {
    const res = await apiFetch(`${API_URL}/month-closings`, {
      method: 'POST',
      authScope: 'staff',
      body: JSON.stringify({ yearMonth, notes: notes || '' }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(body.error || body.message || 'Falha ao registrar fechamento');
      err.status = res.status;
      throw err;
    }
    return body;
  };

  // barberId: null = geral, 'barbershop' = só produtos sem barbeiro, number = barbeiro específico
  const getFinancialStats = useCallback((startDate, endDate, barberId = null) => {
    // Role-based isolation: Barbers always see only their own data
    let effectiveBarberId = barberId;
    if (currentUser && currentUser.role === 'Barbeiro' && !barberId) {
      effectiveBarberId = currentUser.id;
    }

    let finished = appointments.filter(app => app.status === 'Finalizado');
    let soldProducts = [...productSales];
    let periodExpenses = [...expenses];

    if (startDate && endDate) {
      finished = finished.filter(app => app.date >= startDate && app.date <= endDate);
      soldProducts = soldProducts.filter(sale => sale.date >= startDate && sale.date <= endDate);
      periodExpenses = periodExpenses.filter(e => e.date >= startDate && e.date <= endDate);
    }

    if (currentUser && currentUser.role === 'Barbeiro') {
      periodExpenses = [];
    }

    // Filtro por barbeiro
    if (effectiveBarberId === 'barbershop') {
      finished = [];
      soldProducts = soldProducts.filter(sale => !sale.barberId);
    } else if (effectiveBarberId) {
      const id = Number(effectiveBarberId);
      finished = finished.filter(app => Number(app.barberId) === id);
      soldProducts = soldProducts.filter(sale => Number(sale.barberId) === id);
    }
    
    const serviceRevenue = finished.reduce((sum, app) => sum + app.price, 0);
    const productRevenue = soldProducts.reduce((sum, sale) => sum + (sale.price * sale.quantity), 0);
    const productCost = soldProducts.reduce((sum, sale) => sum + (sale.cost * sale.quantity), 0);
    const expensesTotal = periodExpenses.reduce((sum, e) => sum + e.amount, 0);
    
    const revenue = serviceRevenue + productRevenue;
    const itemsCount = finished.length + soldProducts.length;
    return {
      revenue, serviceRevenue, productRevenue, productCost, expenses: expensesTotal,
      profit: revenue - expensesTotal - productCost, count: itemsCount,
      averageTicket: itemsCount > 0 ? revenue / itemsCount : 0,
      appointments: finished,
      sales: soldProducts,
      expensesList: periodExpenses
    };
  }, [appointments, productSales, expenses, currentUser]);

  // Retorna ranking de barbeiros com stats individuais para o período
  // Barbers only see their own stats in the ranking
  const getBarberRanking = useCallback((startDate, endDate) => {
    let targetBarbers = barbers.filter(b => b.role === 'Barbeiro');
    
    // Role-based isolation: Barbers only see themselves
    if (currentUser && currentUser.role === 'Barbeiro') {
      targetBarbers = targetBarbers.filter(b => b.id === currentUser.id);
    }

    return targetBarbers
      .map(barber => {
        const stats = getFinancialStats(startDate, endDate, barber.id);
        return {
          ...barber,
          serviceRevenue: stats.serviceRevenue,
          productRevenue: stats.productRevenue,
          revenue: stats.revenue,
          count: stats.count,
          averageTicket: stats.averageTicket
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, [barbers, currentUser, getFinancialStats]);

  return (
    <AppContext.Provider value={{
      barbers, appointments, services, businessInfo, products, productSales, expenses, monthClosings, periodClosings,
      addAppointment, updateAppointmentStatus, cancelAppointment,
      addBarber, updateBarberPermissions, removeBarber, updateBarber, toggleBarberStatus,
      fetchBarberScheduleBlocks, createBarberScheduleBlock, deleteBarberScheduleBlock,
      addService, removeService, updateService,
      addProduct, removeProduct, updateProduct, adjustProductStock,
      sellProduct, updateBusinessInfo,
      getFinancialStats, getBarberRanking,
      addExpense, removeExpense, updateExpense, refreshMonthClosings, createMonthClosing, refreshPeriodClosings, createPeriodClosing,
      login, logout, currentUser, token, loading,
      currentCustomer, isCustomerAuthenticated: !!currentCustomer, customerLogin, customerGoogleLogin, customerRegister, customerLogout,
      getCustomerAppointments, updateCustomerProfile,
      customerUpdateAppointmentStatus, customerCancelAppointment,
      customerRateAppointment,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
