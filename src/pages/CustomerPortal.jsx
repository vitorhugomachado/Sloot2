import React, { useState, useEffect, useMemo } from 'react';
import { User, Calendar, History, Settings, LogOut, Clock, Check, X } from 'lucide-react';
import AppointmentRatingStars from '../components/AppointmentRatingStars';
import { useApp } from '../context/AppContext';
import { isValidPhone, normalizePhone, PHONE_ERROR } from '../utils/phone';
import './customer-portal-theme.css';

function parseAppointmentDateTime(a) {
  const parts = a.date?.split('-').map(Number);
  if (!parts || parts.length !== 3) return new Date(0);
  const [y, mo, d] = parts;
  const tm = String(a.time || '00:00').match(/^(\d{1,2}):(\d{2})/);
  const hh = tm ? parseInt(tm[1], 10) : 0;
  const mm = tm ? parseInt(tm[2], 10) : 0;
  return new Date(y, mo - 1, d, hh, mm);
}

function sortAppointmentsForPortal(list) {
  const copy = [...list];
  const isPendingLike = (s) => ['Agendado', 'Pendente'].includes(s);
  copy.sort((a, b) => {
    const aP = isPendingLike(a.status);
    const bP = isPendingLike(b.status);
    if (aP && !bP) return -1;
    if (!aP && bP) return 1;
    const ta = parseAppointmentDateTime(a).getTime();
    const tb = parseAppointmentDateTime(b).getTime();
    if (aP && bP) return ta - tb;
    return tb - ta;
  });
  return copy;
}

function getCustomerPortalStatusModifier(status) {
  if (status === 'Agendado' || status === 'Pendente') return 'agendado';
  if (status === 'Confirmado') return 'confirmado';
  if (status === 'Finalizado') return 'finalizado';
  if (status === 'Cancelado') return 'cancelado';
  return 'other';
}

/** Cliente só avalia depois do horário marcado e se não cancelou. */
function appointmentEligibleForCustomerRating(a) {
  if (a.status === 'Cancelado') return false;
  return parseAppointmentDateTime(a).getTime() < Date.now();
}

const CustomerPortal = ({ onBack }) => {
  const {
    currentCustomer,
    customerLogout,
    getCustomerAppointments,
    updateCustomerProfile,
    customerCancelAppointment,
    customerUpdateAppointmentStatus,
    customerRateAppointment,
    businessInfo
  } = useApp();
  const [activeTab, setActiveTab] = useState('overview');
  const [appointments, setAppointments] = useState([]);
  const [ratingSavingId, setRatingSavingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editData, setEditData] = useState({ name: '', email: '', phone: '' });
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [actionMsg, setActionMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    if (activeTab === 'history' || activeTab === 'overview') {
      loadAppointments();
    }
  }, [activeTab]);

  useEffect(() => {
    if (currentCustomer) {
      setEditData({
        name: currentCustomer.name || '',
        email: currentCustomer.email || '',
        phone: currentCustomer.phone || ''
      });
    }
  }, [currentCustomer]);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const data = await getCustomerAppointments();
      setAppointments(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id) => {
    if (window.confirm('Tem certeza que deseja cancelar este agendamento?')) {
      try {
        await customerCancelAppointment(id);
        loadAppointments(); // Refresh list
        setActionMsg({ type: 'success', text: 'Agendamento cancelado com sucesso.' });
        window.setTimeout(() => setActionMsg({ type: '', text: '' }), 2600);
      } catch (error) {
        setActionMsg({ type: 'error', text: 'Não foi possível cancelar o agendamento.' });
        window.setTimeout(() => setActionMsg({ type: '', text: '' }), 3000);
      }
    }
  };

  const handleConfirm = async (id) => {
    try {
      await customerUpdateAppointmentStatus(id, 'Confirmado');
      loadAppointments(); // Refresh list
      setActionMsg({ type: 'success', text: 'Agendamento confirmado com sucesso.' });
      window.setTimeout(() => setActionMsg({ type: '', text: '' }), 2600);
    } catch (error) {
      setActionMsg({ type: 'error', text: 'Não foi possível confirmar o agendamento.' });
      window.setTimeout(() => setActionMsg({ type: '', text: '' }), 3000);
    }
  };

  const handleRateAppointment = async (id, rating) => {
    try {
      setRatingSavingId(id);
      const updated = await customerRateAppointment(id, rating);
      setAppointments((prev) =>
        prev.map((x) => (x.id === id ? { ...x, ...updated } : x))
      );
      setActionMsg({ type: 'success', text: 'Obrigado pela sua avaliação!' });
      window.setTimeout(() => setActionMsg({ type: '', text: '' }), 2600);
    } catch (error) {
      setActionMsg({
        type: 'error',
        text: error?.message || 'Não foi possível guardar a avaliação.',
      });
      window.setTimeout(() => setActionMsg({ type: '', text: '' }), 3200);
    } finally {
      setRatingSavingId(null);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setMsg({ type: '', text: '' });
    if (!isValidPhone(editData.phone)) {
      setMsg({ type: 'error', text: PHONE_ERROR });
      return;
    }
    try {
      await updateCustomerProfile({ ...editData, phone: normalizePhone(editData.phone) });
      setMsg({ type: 'success', text: 'Perfil atualizado com sucesso!' });
    } catch (error) {
      setMsg({ type: 'error', text: error.message });
    }
  };

  const handleLogout = () => {
    customerLogout();
    onBack();
  };

  const sortedAppointments = useMemo(
    () => sortAppointmentsForPortal(appointments),
    [appointments]
  );

  const upcoming = appointments.filter(a => a.status === 'Agendado')[0];
  const history = appointments.filter(a => a.status !== 'Agendado');

  const renderOverview = () => (
    <div className="fade-in">
      <div className="glass-card customer-portal-welcome" style={{ padding: '2rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <div className="customer-portal-welcome__avatar">
          {currentCustomer?.name?.charAt(0).toUpperCase()}
        </div>
        <div>
          <h2 style={{ fontSize: '1.4rem', margin: 0 }}>Olá, {currentCustomer?.name?.split(' ')[0]}!</h2>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0' }}>Bem-vindo à sua área exclusiva.</p>
        </div>
      </div>

      <div className="customer-portal-overview-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} style={{ color: 'var(--text-primary)' }} /> Próximo Agendamento
          </h3>
          {upcoming ? (
            <div className="customer-portal-upcoming-card">
              <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '4px' }}>{upcoming.service}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={14} /> {upcoming.date.split('-').reverse().join('/')}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={14} /> {upcoming.time}</span>
              </div>
              <div style={{ marginTop: '8px', fontSize: '0.9rem' }}>
                Profissional: <span style={{ fontWeight: 600 }}>{upcoming.Barber?.name || upcoming.barber?.name}</span>
              </div>
              <div className="customer-portal-upcoming-actions">
                <button
                  type="button"
                  className="sloot-circle-action sloot-circle-action--confirm sloot-circle-action--lg"
                  onClick={() => handleConfirm(upcoming.id)}
                  aria-label="Confirmar agendamento"
                  title="Confirmar agendamento"
                >
                  <Check size={26} strokeWidth={2.4} />
                </button>
                <button
                  type="button"
                  className="sloot-circle-action sloot-circle-action--cancel-outline sloot-circle-action--lg"
                  onClick={() => handleCancel(upcoming.id)}
                  aria-label="Cancelar agendamento"
                  title="Cancelar agendamento"
                >
                  <X size={26} strokeWidth={2.4} />
                </button>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Você não possui agendamentos futuros.
            </div>
          )}
        </div>

        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History size={18} style={{ color: 'var(--text-primary)' }} /> Resumo
          </h3>
          <div className="customer-portal-stat-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--surface-color)', borderRadius: '12px' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{appointments.length}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total</div>
            </div>
            <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--surface-color)', borderRadius: '12px' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{history.length}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Finalizados</div>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '2rem', marginTop: '2rem', textAlign: 'center' }}>
        <h3 style={{ marginBottom: '1rem' }}>Precisa de um novo serviço?</h3>
        <button 
          className="btn-primary" 
          onClick={onBack}
          style={{ width: 'auto', padding: '12px 30px' }}
        >
          Agendar Novo Serviço
        </button>
      </div>
    </div>
  );

  const renderHistory = () => (
    <div className="fade-in">
      <header className="customer-portal-history-header">
        <div className="customer-portal-history-header__text">
          <h2 className="customer-portal-history-title">Histórico de Serviços</h2>
          <p className="customer-portal-history-subtitle">Veja e confirme os seus serviços</p>
        </div>
        {!loading && appointments.length > 0 && (
          <span className="customer-portal-history-count-badge" aria-label={`${appointments.length} marcações`}>
            {appointments.length}
          </span>
        )}
      </header>
      {loading ? (
        <div className="customer-portal-history-skeleton" aria-busy="true" aria-label="A carregar agendamentos">
          <div className="customer-portal-skeleton-card" />
          <div className="customer-portal-skeleton-card" />
          <div className="customer-portal-skeleton-card" />
        </div>
      ) : appointments.length === 0 ? (
        <div className="glass-card customer-portal-history-empty">
          <Calendar size={40} strokeWidth={1.5} className="customer-portal-history-empty__icon" aria-hidden />
          <p className="customer-portal-history-empty__message">
            Ainda não tem agendamentos nesta conta. Reserve estando logado para que apareçam aqui.
          </p>
          <button type="button" className="btn-primary customer-portal-history-empty__cta" onClick={onBack}>
            Agendar novo serviço
          </button>
        </div>
      ) : (
        <div className="customer-portal-history-list">
          {sortedAppointments.map(a => {
            const statusMod = getCustomerPortalStatusModifier(a.status);
            return (
            <div
              key={a.id}
              className={`glass-card customer-portal-appointment-card customer-portal-appointment-card--${statusMod}`}
            >
              <div className="customer-portal-appointment-card__main">
                <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '4px' }}>{a.service}</div>
                <div className="customer-portal-appointment-card__details">
                   <span>{a.date?.split('-').reverse().join('/') || a.date} às {a.time}</span>
                   <span className="customer-portal-appointment-card__dot" aria-hidden>•</span>
                   <span>Profissional: {a.Barber?.name || a.barber?.name || 'Não informado'}</span>
                </div>
              </div>
              <div className="customer-portal-appointment-card__meta">
                <div className="customer-portal-appointment-card__price-row">
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>R$ {a.price.toFixed(2)}</span>
                  <span className={`customer-portal-status-pill customer-portal-status-pill--${statusMod}`}>
                    {a.status}
                  </span>
                </div>
                {['Agendado', 'Pendente'].includes(a.status) && (
                  <div className="customer-portal-appointment-actions">
                    <button
                      type="button"
                      onClick={() => handleConfirm(a.id)}
                      className="sloot-circle-action sloot-circle-action--confirm sloot-circle-action--md"
                      aria-label="Confirmar agendamento"
                      title="Confirmar agendamento"
                    >
                      <Check size={22} strokeWidth={2.4} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCancel(a.id)}
                      className="sloot-circle-action sloot-circle-action--cancel-outline sloot-circle-action--md"
                      aria-label="Cancelar agendamento"
                      title="Cancelar agendamento"
                    >
                      <X size={22} strokeWidth={2.4} />
                    </button>
                  </div>
                )}
              </div>
              {a.status !== 'Cancelado' &&
                (appointmentEligibleForCustomerRating(a) ? (
                  <AppointmentRatingStars
                    value={a.customer_rating != null ? Number(a.customer_rating) : null}
                    onRate={(stars) => handleRateAppointment(a.id, stars)}
                    saving={ratingSavingId === a.id}
                  />
                ) : (
                  <p className="customer-portal-rating-wait">
                    Quando o horário do serviço passar, poderá avaliar o atendimento com estrelas.
                  </p>
                ))}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderProfile = () => (
    <div className="fade-in">
      <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Meus Dados</h2>
      <div className="glass-card" style={{ padding: '2rem', maxWidth: '600px' }}>
        <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {msg.text && (
            <div style={{ 
              padding: '12px', 
              borderRadius: '8px', 
              background: msg.type === 'success' ? '#d1fae5' : '#fee2e2',
              color: msg.type === 'success' ? '#065f46' : '#991b1b',
              fontSize: '0.9rem',
              fontWeight: 600
            }}>
              {msg.text}
            </div>
          )}
          
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Nome Completo</label>
            <input 
              type="text" 
              className="customer-portal-profile-input"
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
              value={editData.name}
              onChange={e => setEditData({...editData, name: e.target.value})}
              required
            />
          </div>

          <div className="customer-portal-profile-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>E-mail</label>
              <input 
                type="email" 
                className="customer-portal-profile-input"
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                value={editData.email}
                disabled
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Telefone</label>
              <input 
                type="text" 
                className="customer-portal-profile-input"
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                value={editData.phone}
                onChange={e => setEditData({...editData, phone: e.target.value})}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn-primary" style={{ marginTop: '1rem' }}>Salvar Alterações</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="customer-portal-root">
      <div className="customer-portal-inner">
        
        {/* Header */}
        <div className="customer-portal-header">
          <div className="customer-portal-header-brand">
            <button 
              type="button"
              onClick={onBack}
              className="customer-portal-header-btn customer-portal-header-btn--neutral"
            >
              ← Voltar
            </button>
            {businessInfo?.logo_url && (
              <img src={businessInfo.logo_url} alt="Logo" style={{ height: '40px', borderRadius: '8px', objectFit: 'contain', flexShrink: 0 }} />
            )}
            <h1 className="customer-portal-title">{businessInfo?.name || 'Customer Portal'}</h1>
          </div>
          <button 
            type="button"
            onClick={handleLogout}
            className="customer-portal-header-btn customer-portal-header-btn--danger"
          >
            <LogOut size={18} /> Sair
          </button>
        </div>

        {actionMsg.text && (
          <div
            className="glass-card fade-in"
            style={{
              marginBottom: '1rem',
              padding: '0.85rem 1rem',
              border: actionMsg.type === 'success'
                ? '1px solid rgba(16, 185, 129, 0.35)'
                : '1px solid rgba(239, 68, 68, 0.35)',
              background: actionMsg.type === 'success'
                ? 'rgba(16, 185, 129, 0.08)'
                : 'rgba(239, 68, 68, 0.08)',
              color: actionMsg.type === 'success'
                ? '#065f46'
                : '#991b1b',
              fontWeight: 600,
              fontSize: '0.9rem',
            }}
          >
            {actionMsg.text}
          </div>
        )}

        <div className="customer-portal-shell">
          {/* Sidebar / tabs */}
          <div className="customer-portal-sidebar">
            <div className="glass-card customer-portal-tabs">
              <button 
                type="button"
                className={`customer-portal-tab ${activeTab === 'overview' ? 'customer-portal-tab--active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                <User size={18} /> Início
              </button>
              <button 
                type="button"
                className={`customer-portal-tab ${activeTab === 'history' ? 'customer-portal-tab--active' : ''}`}
                onClick={() => setActiveTab('history')}
              >
                <Calendar size={18} /> Agendamentos
              </button>
              <button 
                type="button"
                className={`customer-portal-tab ${activeTab === 'profile' ? 'customer-portal-tab--active' : ''}`}
                onClick={() => setActiveTab('profile')}
              >
                <Settings size={18} /> Meus Dados
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="customer-portal-content">
            {activeTab === 'overview' && renderOverview()}
            {activeTab === 'history' && renderHistory()}
            {activeTab === 'profile' && renderProfile()}
          </div>
        </div>

      </div>
    </div>
  );
};

export default CustomerPortal;
