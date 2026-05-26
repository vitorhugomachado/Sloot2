import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '../context/TenantContext';
import { tenantDashboardPath } from '../constants/tenantRoutes';
import {
  Search, Plus, Filter, User, Phone, Calendar, Download, Cake, AlertTriangle,
  RefreshCw, ChevronLeft, ChevronRight, Trash2, UserPlus, Award
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import ClientFormModal from '../components/ClientFormModal';
import ClientProfileDrawer from '../components/ClientProfileDrawer';
import WhatsAppIcon from '../components/icons/WhatsAppIcon';
import { API_URL } from '../config/apiUrl';

const PAGE_SIZE = 10;

const STATUS_FILTERS = [
  { id: 'todos', label: 'Todos' },
  { id: 'Ativo', label: 'Ativos' },
  { id: 'Pendente', label: 'Pendentes' },
  { id: 'Inativo', label: 'Inativos' },
  { id: 'Novo', label: 'Novos' }
];

const STATUS_BADGE = {
  Ativo: { bg: 'rgba(34,197,94,0.15)', color: '#16a34a' },
  Inativo: { bg: 'rgba(220,38,38,0.12)', color: '#dc2626' },
  Pendente: { bg: 'rgba(234,179,8,0.18)', color: '#a16207' },
  Novo: { bg: 'rgba(255, 106, 0, 0.12)', color: '#FF6A00' }
};

const formatPhone = (raw) => {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '—';
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const formatCurrency = (value) => Number(value || 0).toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});

const formatDate = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('pt-BR');
  } catch {
    return value;
  }
};

const useDebounce = (value, delay = 300) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handle);
  }, [value, delay]);
  return debounced;
};

const ClientMobileCard = ({ client, onOpenProfile }) => {
  const badge = STATUS_BADGE[client.status] || { bg: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)' };
  const phoneDigits = String(client.phone || '').replace(/\D/g, '');
  const waLink = phoneDigits
    ? `https://wa.me/55${phoneDigits}?text=${encodeURIComponent(`Olá ${client.name}!`)}`
    : null;
  return (
    <article className="crm-mobile-client-card glass-card">
      <div className="crm-mobile-client-card__top">
        <div className="crm-mobile-client-card__avatar">
          <User size={20} color="var(--text-secondary)" />
        </div>
        <div className="crm-mobile-client-card__main">
          <div className="crm-mobile-client-card__name-row">
            <span className="crm-mobile-client-card__name">{client.name}</span>
            {client.source === 'guest' && (
              <span className="crm-mobile-client-card__guest-badge">não cadastrado</span>
            )}
            <span
              className="crm-mobile-client-card__status-pill"
              style={{ background: badge.bg, color: badge.color }}
            >
              {client.status}
            </span>
          </div>
          {client.tags?.length > 0 && (
            <div className="crm-mobile-client-card__tags">
              {client.tags.slice(0, 4).map((t) => (
                <span key={t} className="crm-mobile-client-card__tag">{t}</span>
              ))}
            </div>
          )}
          <div className="crm-mobile-client-card__phone">
            <Phone size={14} /> {formatPhone(client.phone)}
          </div>
          <div className="crm-mobile-client-card__dates">
            <span>
              <Calendar size={12} aria-hidden /> Última: {formatDate(client.lastVisit)}
            </span>
            <span>
              Próx.:{' '}
              {client.nextAppointment
                ? `${formatDate(client.nextAppointment.date)} · ${client.nextAppointment.time}`
                : '—'}
            </span>
          </div>
          <div className="crm-mobile-client-card__stats">
            <span>{client.visitCount || 0} visitas</span>
            <span className="crm-mobile-client-card__money">{formatCurrency(client.totalSpent)}</span>
          </div>
        </div>
      </div>
      <div className="crm-mobile-client-card__actions">
        {waLink ? (
          <a href={waLink} target="_blank" rel="noreferrer" className="wa-btn crm-mobile-client-card__wa" title="WhatsApp">
            <WhatsAppIcon size={16} /> WhatsApp
          </a>
        ) : (
          <span className="crm-mobile-client-card__wa-spacer" />
        )}
        <button type="button" className="btn-secondary crm-mobile-client-card__profile" onClick={() => onOpenProfile(client)}>
          Perfil
        </button>
      </div>
    </article>
  );
};

const Clients = () => {
  const { token, apiFetch } = useApp();
  const { slug } = useTenant();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [status, setStatus] = useState('todos');
  const [tagFilter, setTagFilter] = useState('');
  const [page, setPage] = useState(1);

  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [stats, setStats] = useState(null);

  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [formInitial, setFormInitial] = useState(null);

  const [activeProfile, setActiveProfile] = useState(null);
  const [profileHistory, setProfileHistory] = useState([]);
  const [profileLoading, setProfileLoading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [isClientsNarrow, setIsClientsNarrow] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  );

  const debouncedSearch = useDebounce(searchTerm, 300);
  const fetchSeqRef = useRef(0);

  const fetchClients = useCallback(async () => {
    if (!token) return;
    const seq = ++fetchSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(PAGE_SIZE));
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (status && status !== 'todos') params.set('status', status);
      if (tagFilter) params.set('tag', tagFilter);

      const res = await apiFetch(`${API_URL}/clients?${params.toString()}`, { authScope: 'staff' });
      if (!res.ok) throw new Error((await res.json()).message || 'Erro ao carregar clientes');
      const data = await res.json();
      if (seq !== fetchSeqRef.current) return;
      setItems(data.items || []);
      setMeta(data.meta || { total: 0, page: 1, totalPages: 1 });
    } catch (err) {
      if (seq !== fetchSeqRef.current) return;
      setError(err.message || 'Erro ao carregar clientes');
    } finally {
      if (seq === fetchSeqRef.current) setLoading(false);
    }
  }, [debouncedSearch, page, status, tagFilter, token, slug]);

  const fetchStats = useCallback(async () => {
    if (!token) return;
    setStatsLoading(true);
    try {
      const res = await apiFetch(`${API_URL}/clients/stats`, { authScope: 'staff' });
      if (res.ok) setStats(await res.json());
    } catch (err) {
      console.error('Erro stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, [token, slug]);

  useEffect(() => { fetchClients(); }, [fetchClients]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, tagFilter]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const fn = () => setIsClientsNarrow(mq.matches);
    fn();
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  const tagsAvailable = useMemo(() => {
    const set = new Set();
    items.forEach((c) => (c.tags || []).forEach((t) => set.add(t)));
    return [...set].sort();
  }, [items]);

  const refresh = () => {
    fetchClients();
    fetchStats();
  };

  const openCreate = () => {
    setFormMode('create');
    setFormInitial(null);
    setFormOpen(true);
  };

  const openEdit = (client) => {
    setFormMode('edit');
    setFormInitial(client);
    setFormOpen(true);
  };

  const submitForm = async (payload) => {
    const isEdit = formMode === 'edit' && formInitial?.source === 'customer';
    const url = isEdit ? `${API_URL}/clients/${formInitial.id}` : `${API_URL}/clients`;
    const res = await apiFetch(url, {
      method: isEdit ? 'PATCH' : 'POST',
      authScope: 'staff',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Erro ao salvar');
    }
    refresh();
    if (activeProfile && activeProfile.source === 'customer' && activeProfile.id === formInitial?.id) {
      const updated = await res.json();
      setActiveProfile((prev) => prev ? { ...prev, ...updated } : prev);
    }
  };

  const openProfile = async (client) => {
    setActiveProfile(client);
    setProfileHistory([]);
    setProfileLoading(true);
    try {
      const params = new URLSearchParams();
      if (client.source === 'guest' && client.guestKey) params.set('guestKey', client.guestKey);
      const id = client.source === 'customer' ? client.id : 'guest';
      const res = await apiFetch(`${API_URL}/clients/${id}?${params.toString()}`, { authScope: 'staff' });
      if (res.ok) {
        const data = await res.json();
        setActiveProfile((prev) => prev ? { ...prev, ...data } : data);
        setProfileHistory(data.history || []);
      }
    } catch (err) {
      console.error('Erro perfil:', err);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleProfileSave = async ({ notes, tags }) => {
    if (!activeProfile || activeProfile.source !== 'customer') return;
    setSavingProfile(true);
    try {
      const res = await apiFetch(`${API_URL}/clients/${activeProfile.id}`, {
        method: 'PATCH',
        authScope: 'staff',
        body: JSON.stringify({ notes, tags }),
      });
      if (res.ok) {
        const updated = await res.json();
        setActiveProfile((prev) => prev ? { ...prev, notes: updated.notes, tags: updated.tags || [] } : prev);
        refresh();
      }
    } finally {
      setSavingProfile(false);
    }
  };

  const handleProfileDelete = async (client) => {
    if (!client || client.source !== 'customer') return;
    if (!window.confirm(`Excluir o cliente ${client.name}? Os agendamentos serão preservados, mas o vínculo será removido.`)) return;
    const res = await apiFetch(`${API_URL}/clients/${client.id}`, {
      method: 'DELETE',
      authScope: 'staff',
    });
    if (res.ok) {
      setActiveProfile(null);
      refresh();
    } else {
      alert('Falha ao excluir cliente.');
    }
  };

  const handlePromote = async (client) => {
    if (!client || client.source !== 'guest') return;
    if (!window.confirm(`Cadastrar ${client.name} (${formatPhone(client.phone)}) como cliente oficial?`)) return;
    const res = await apiFetch(`${API_URL}/clients/promote`, {
      method: 'POST',
      authScope: 'staff',
      body: JSON.stringify({ name: client.name, phone: client.phone, email: client.email }),
    });
    if (res.ok) {
      const data = await res.json();
      setActiveProfile(null);
      refresh();
      setTimeout(() => openProfile({ ...client, ...data, source: 'customer', id: data.id }), 300);
    } else {
      const err = await res.json();
      alert(err.message || 'Falha ao promover cliente.');
    }
  };

  const handleSchedule = (client) => {
    try {
      sessionStorage.setItem('scheduler_prefill', JSON.stringify({
        customer: client.name,
        phone: client.phone,
        customer_id: client.source === 'customer' ? client.id : null
      }));
    } catch {}
    navigate(tenantDashboardPath(slug, 'scheduler'));
  };

  const handleExport = () => {
    if (!token) return;
    const url = `${API_URL}/clients/export`;
    apiFetch(url, { authScope: 'staff' })
      .then((r) => r.blob())
      .then((blob) => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'clientes.csv';
        document.body.appendChild(link);
        link.click();
        link.remove();
      })
      .catch(() => alert('Falha ao exportar.'));
  };

  return (
    <div className={isClientsNarrow ? 'clients-page clients-page--mobile fade-in' : 'clients-page fade-in'}>
      {!isClientsNarrow ? (
      <>
      <header style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', marginBottom: '6px' }}>CRM - Gestão de Clientes</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Histórico, frequência, gastos, retenção e ações rápidas em um único lugar.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={refresh} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={16} /> Atualizar
          </button>
          <button onClick={handleExport} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Download size={16} /> Exportar CSV
          </button>
          <button onClick={openCreate} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={16} /> Novo Cliente
          </button>
        </div>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}
      >
        <KpiCard
          label="Total de clientes"
          value={statsLoading ? '...' : stats?.total ?? 0}
          tone="default"
        />
        <KpiCard
          label="Ativos (60 dias)"
          value={statsLoading ? '...' : stats?.ativos ?? 0}
          tone="success"
        />
        <KpiCard
          label="Novos no mês"
          value={statsLoading ? '...' : stats?.novosNoMes ?? 0}
          tone="info"
        />
        <KpiCard
          label="Ticket médio"
          value={statsLoading ? '...' : formatCurrency(stats?.ticketMedio || 0)}
          tone="default"
        />
        <KpiCard
          label="Aniversariantes do mês"
          value={statsLoading ? '...' : stats?.aniversariantesDoMes?.length ?? 0}
          tone="info"
        />
      </div>

      <div className="glass-card" style={{ padding: '0', overflow: 'hidden', marginBottom: '1.5rem' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 280px', position: 'relative', minWidth: 'min(100%, 280px)' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input
              type="text"
              placeholder="Buscar por nome, telefone ou e-mail..."
              style={{
                width: '100%',
                padding: '10px 10px 10px 40px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                fontSize: '0.9rem',
                outline: 'none',
                background: 'rgba(0,0,0,0.01)'
              }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {STATUS_FILTERS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setStatus(opt.id)}
                className={status === opt.id ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {tagsAvailable.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Filter size={14} color="var(--text-secondary)" />
              <select
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                style={{
                  padding: '8px 10px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  background: 'rgba(0,0,0,0.01)',
                  fontSize: '0.85rem'
                }}
              >
                <option value="">Todas as tags</option>
                {tagsAvailable.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}
        </div>

        {error && (
          <div style={{ padding: '1rem 1.5rem', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        <div className="table-responsive">
          <table className="crm-clients-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: '880px' }}>
            <thead style={{ background: 'rgba(0,0,0,0.01)' }}>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                <Th>Cliente</Th>
                <Th>Contato</Th>
                <Th>Última visita</Th>
                <Th>Próx. agendamento</Th>
                <Th align="right">Visitas</Th>
                <Th align="right">Total gasto</Th>
                <Th>Status</Th>
                <Th align="right">Ações</Th>
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 && (
                <tr><td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Carregando...</td></tr>
              )}
              {!loading && items.length === 0 && (
                <tr><td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  Nenhum cliente encontrado para esses filtros.
                </td></tr>
              )}
              {items.map((client) => {
                const badge = STATUS_BADGE[client.status] || { bg: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)' };
                const phoneDigits = String(client.phone || '').replace(/\D/g, '');
                const waLink = phoneDigits
                  ? `https://wa.me/55${phoneDigits}?text=${encodeURIComponent(`Olá ${client.name}!`)}`
                  : null;
                return (
                  <tr key={`${client.source}-${client.id || client.guestKey}`} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td className="crm-clients-td">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '36px', height: '36px', background: 'rgba(0,0,0,0.05)', borderRadius: '50%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                        }}>
                          <User size={18} color="var(--text-secondary)" />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            {client.name}
                            {client.source === 'guest' && (
                              <span style={{
                                fontSize: '0.65rem',
                                padding: '1px 6px',
                                borderRadius: '8px',
                                background: 'rgba(234,179,8,0.18)',
                                color: '#a16207',
                                fontWeight: 600
                              }}>
                                não cadastrado
                              </span>
                            )}
                          </div>
                          {client.tags?.length > 0 && (
                            <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                              {client.tags.slice(0, 3).map((t) => (
                                <span key={t} style={{
                                  fontSize: '0.65rem',
                                  padding: '1px 6px',
                                  background: 'rgba(0,0,0,0.05)',
                                  borderRadius: '8px'
                                }}>{t}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="crm-clients-td">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                        <Phone size={14} style={{ flexShrink: 0 }} /> {formatPhone(client.phone)}
                      </div>
                    </td>
                    <td className="crm-clients-td">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                        <Calendar size={14} style={{ flexShrink: 0 }} /> {formatDate(client.lastVisit)}
                      </div>
                    </td>
                    <td className="crm-clients-td" style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                      {client.nextAppointment
                        ? `${formatDate(client.nextAppointment.date)} • ${client.nextAppointment.time}`
                        : '—'}
                    </td>
                    <td className="crm-clients-td crm-clients-td--numeric crm-clients-td--visits">{client.visitCount || 0}</td>
                    <td className="crm-clients-td crm-clients-td--numeric crm-clients-td--money">{formatCurrency(client.totalSpent)}</td>
                    <td className="crm-clients-td">
                      <span style={{
                        padding: '3px 10px',
                        borderRadius: '14px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: badge.bg,
                        color: badge.color
                      }}>
                        {client.status}
                      </span>
                    </td>
                    <td className="crm-clients-td crm-clients-td--actions">
                      <div style={{ display: 'inline-flex', gap: '4px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        {waLink && (
                          <a href={waLink} target="_blank" rel="noreferrer" className="wa-btn wa-btn--icon" title="WhatsApp">
                            <WhatsAppIcon size={14} />
                          </a>
                        )}
                        <button onClick={() => openProfile(client)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
                          Perfil
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          <span>{meta.total} clientes • página {meta.page} de {meta.totalPages}</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn-secondary"
              style={{ padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft size={14} /> Anterior
            </button>
            <button
              className="btn-secondary"
              style={{ padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
        <SidePanel
          title="Aniversariantes do mês"
          icon={<Cake size={18} />}
          empty="Nenhum aniversariante neste mês."
          items={stats?.aniversariantesDoMes || []}
          renderItem={(c) => (
            <li
              key={`b-${c.source}-${c.id || c.guestKey}`}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px dashed var(--border-color)' }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{c.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {formatDate(c.birthday)} • {formatPhone(c.phone)}
                </div>
              </div>
              {c.phone && (
                <a
                  href={`https://wa.me/55${String(c.phone).replace(/\D/g, '')}?text=${encodeURIComponent(`Parabéns, ${c.name}!`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="wa-btn"
                >
                  <WhatsAppIcon size={12} /> Parabenizar
                </a>
              )}
            </li>
          )}
        />

        <SidePanel
          title="A reativar (60+ dias)"
          icon={<UserPlus size={18} />}
          empty="Nenhum cliente para reativar no momento."
          items={stats?.inativos || []}
          renderItem={(c) => (
            <li
              key={`i-${c.source}-${c.id || c.guestKey}`}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px dashed var(--border-color)' }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{c.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Última visita: {formatDate(c.lastVisit)} • {formatCurrency(c.totalSpent)}
                </div>
              </div>
              {c.phone && (
                <a
                  href={`https://wa.me/55${String(c.phone).replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${c.name}, sentimos sua falta! Que tal agendarmos um horário?`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="wa-btn"
                >
                  <WhatsAppIcon size={12} /> Reativar
                </a>
              )}
            </li>
          )}
        />

        <SidePanel
          title="Top clientes"
          icon={<Trash2 size={18} style={{ visibility: 'hidden' }} />}
          empty="Sem dados suficientes."
          items={stats?.top || []}
          renderItem={(c, idx) => (
            <li
              key={`t-${c.source}-${c.id || c.guestKey}`}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px dashed var(--border-color)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{
                  width: '24px', height: '24px', borderRadius: '50%',
                  background: 'var(--brand-300, rgba(0,0,0,0.05))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.78rem', fontWeight: 700
                }}>{idx + 1}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{c.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{c.visitCount} visitas</div>
                </div>
              </div>
              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{formatCurrency(c.totalSpent)}</span>
            </li>
          )}
        />
      </div>
      </>
      ) : (
      <>
        <header className="crm-mobile-header">
          <div className="crm-mobile-header__top">
            <div className="crm-mobile-header__titles">
              <h1 className="crm-mobile-title">CRM · Clientes</h1>
              <p className="crm-mobile-sub">Histórico, gastos e ações rápidas.</p>
            </div>
            <div className="crm-mobile-header__toolbar">
              <button type="button" className="btn-secondary crm-mobile-icon-btn" onClick={refresh} aria-label="Atualizar">
                <RefreshCw size={20} />
              </button>
              <button type="button" className="btn-secondary crm-mobile-icon-btn" onClick={handleExport} aria-label="Exportar CSV">
                <Download size={20} />
              </button>
            </div>
          </div>
          <button type="button" className="btn-primary crm-mobile-new-full" onClick={openCreate}>
            <Plus size={18} /> Novo cliente
          </button>
        </header>

        <div className="crm-mobile-kpi-scroll hide-scrollbar">
          <div className="crm-mobile-kpi-track">
            <div className="crm-mobile-kpi-chip glass-card">
              <div className="crm-mobile-kpi-chip__label">Total</div>
              <div className="crm-mobile-kpi-chip__value">{statsLoading ? '…' : stats?.total ?? 0}</div>
            </div>
            <div className="crm-mobile-kpi-chip glass-card crm-mobile-kpi-chip--success">
              <div className="crm-mobile-kpi-chip__label">Ativos 60d</div>
              <div className="crm-mobile-kpi-chip__value">{statsLoading ? '…' : stats?.ativos ?? 0}</div>
            </div>
            <div className="crm-mobile-kpi-chip glass-card crm-mobile-kpi-chip--info">
              <div className="crm-mobile-kpi-chip__label">Novos mês</div>
              <div className="crm-mobile-kpi-chip__value">{statsLoading ? '…' : stats?.novosNoMes ?? 0}</div>
            </div>
            <div className="crm-mobile-kpi-chip glass-card">
              <div className="crm-mobile-kpi-chip__label">Ticket médio</div>
              <div className="crm-mobile-kpi-chip__value">{statsLoading ? '…' : formatCurrency(stats?.ticketMedio || 0)}</div>
            </div>
            <div className="crm-mobile-kpi-chip glass-card crm-mobile-kpi-chip--info">
              <div className="crm-mobile-kpi-chip__label">Aniversários</div>
              <div className="crm-mobile-kpi-chip__value">{statsLoading ? '…' : stats?.aniversariantesDoMes?.length ?? 0}</div>
            </div>
          </div>
        </div>

        <div className="glass-card crm-mobile-list-card">
          <div className="crm-mobile-filters">
            <div className="crm-mobile-search-wrap">
              <Search size={18} className="crm-mobile-search-icon" aria-hidden />
              <input
                type="text"
                className="crm-mobile-search-input"
                placeholder="Nome, telefone ou e-mail..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="crm-mobile-status-chips hide-scrollbar">
              {STATUS_FILTERS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setStatus(opt.id)}
                  className={`crm-mobile-status-chip${status === opt.id ? ' crm-mobile-status-chip--active' : ''}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {tagsAvailable.length > 0 && (
              <div className="crm-mobile-tag-row">
                <Filter size={14} color="var(--text-secondary)" aria-hidden />
                <select className="crm-mobile-tag-select" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
                  <option value="">Todas as tags</option>
                  {tagsAvailable.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {error && (
            <div className="crm-mobile-error">
              <AlertTriangle size={16} /> {error}
            </div>
          )}

          <div className="crm-mobile-client-list">
            {loading && items.length === 0 && (
              <p className="crm-mobile-empty">Carregando...</p>
            )}
            {!loading && items.length === 0 && (
              <p className="crm-mobile-empty">Nenhum cliente encontrado para esses filtros.</p>
            )}
            {items.map((client) => (
              <ClientMobileCard
                key={`${client.source}-${client.id || client.guestKey}`}
                client={client}
                onOpenProfile={openProfile}
              />
            ))}
          </div>

          <div className="crm-mobile-pagination">
            <span className="crm-mobile-pagination__meta">{meta.total} clientes · p. {meta.page} de {meta.totalPages}</span>
            <div className="crm-mobile-pagination__btns">
              <button
                type="button"
                className="btn-secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={16} /> Anterior
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        <section className="crm-mobile-insights">
          <details className="crm-mobile-details" open>
            <summary className="crm-mobile-details__summary">
              <Cake size={18} aria-hidden /> Aniversariantes do mês
            </summary>
            <div className="crm-mobile-details__body">
              {(!stats?.aniversariantesDoMes || stats.aniversariantesDoMes.length === 0) ? (
                <p className="crm-mobile-details__empty">Nenhum aniversariante neste mês.</p>
              ) : (
                <ul className="crm-mobile-details__list">
                  {stats.aniversariantesDoMes.map((c) => (
                    <li key={`mb-${c.source}-${c.id || c.guestKey}`} className="crm-mobile-details__item">
                      <div>
                        <div className="crm-mobile-details__item-name">{c.name}</div>
                        <div className="crm-mobile-details__item-meta">{formatDate(c.birthday)} · {formatPhone(c.phone)}</div>
                      </div>
                      {c.phone && (
                        <a
                          href={`https://wa.me/55${String(c.phone).replace(/\D/g, '')}?text=${encodeURIComponent(`Parabéns, ${c.name}!`)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="wa-btn"
                        >
                          <WhatsAppIcon size={12} /> Parabenizar
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </details>

          <details className="crm-mobile-details">
            <summary className="crm-mobile-details__summary">
              <UserPlus size={18} aria-hidden /> A reativar (60+ dias)
            </summary>
            <div className="crm-mobile-details__body">
              {(!stats?.inativos || stats.inativos.length === 0) ? (
                <p className="crm-mobile-details__empty">Nenhum cliente para reativar no momento.</p>
              ) : (
                <ul className="crm-mobile-details__list">
                  {stats.inativos.map((c) => (
                    <li key={`mi-${c.source}-${c.id || c.guestKey}`} className="crm-mobile-details__item">
                      <div>
                        <div className="crm-mobile-details__item-name">{c.name}</div>
                        <div className="crm-mobile-details__item-meta">
                          Última visita: {formatDate(c.lastVisit)} · {formatCurrency(c.totalSpent)}
                        </div>
                      </div>
                      {c.phone && (
                        <a
                          href={`https://wa.me/55${String(c.phone).replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${c.name}, sentimos sua falta! Que tal agendarmos um horário?`)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="wa-btn"
                        >
                          <WhatsAppIcon size={12} /> Reativar
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </details>

          <details className="crm-mobile-details">
            <summary className="crm-mobile-details__summary">
              <Award size={18} aria-hidden /> Top clientes
            </summary>
            <div className="crm-mobile-details__body">
              {(!stats?.top || stats.top.length === 0) ? (
                <p className="crm-mobile-details__empty">Sem dados suficientes.</p>
              ) : (
                <ul className="crm-mobile-details__list">
                  {stats.top.map((c, idx) => (
                    <li key={`mt-${c.source}-${c.id || c.guestKey}`} className="crm-mobile-details__item crm-mobile-details__item--top">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className="crm-mobile-details__rank">{idx + 1}</span>
                        <div>
                          <div className="crm-mobile-details__item-name">{c.name}</div>
                          <div className="crm-mobile-details__item-meta">{c.visitCount} visitas</div>
                        </div>
                      </div>
                      <span className="crm-mobile-details__top-value">{formatCurrency(c.totalSpent)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </details>
        </section>
      </>
      )}

      <ClientFormModal
        open={formOpen}
        mode={formMode}
        initialData={formInitial}
        onClose={() => setFormOpen(false)}
        onSubmit={submitForm}
      />

      {activeProfile && (
        <ClientProfileDrawer
          client={activeProfile}
          history={profileHistory}
          onClose={() => setActiveProfile(null)}
          onSave={handleProfileSave}
          onDelete={handleProfileDelete}
          onPromote={handlePromote}
          onSchedule={handleSchedule}
          onEdit={openEdit}
          saving={savingProfile || profileLoading}
        />
      )}
    </div>
  );
};

const Th = ({ children, align = 'left' }) => (
  <th
    style={{
      padding: '12px 1rem',
      fontSize: '0.78rem',
      color: 'var(--text-secondary)',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      textAlign: align,
      verticalAlign: 'middle',
      whiteSpace: 'nowrap'
    }}
  >
    {children}
  </th>
);

const TONE_BG = {
  default: 'transparent',
  success: 'rgba(34,197,94,0.08)',
  info: 'rgba(59,130,246,0.08)'
};

const KpiCard = ({ label, value, tone = 'default' }) => (
  <div className="glass-card" style={{ padding: '1.1rem 1.25rem', background: TONE_BG[tone] || 'transparent' }}>
    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{label}</div>
    <div style={{ fontSize: '1.6rem', fontWeight: 700, marginTop: '6px' }}>{value}</div>
  </div>
);

const SidePanel = ({ title, icon, items, renderItem, empty }) => (
  <div className="glass-card" style={{ padding: '1.25rem' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
      {icon}
      <h3 style={{ margin: 0, fontSize: '1rem' }}>{title}</h3>
    </div>
    {(!items || items.length === 0) ? (
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>{empty}</p>
    ) : (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {items.map((item, idx) => renderItem(item, idx))}
      </ul>
    )}
  </div>
);

export default Clients;
