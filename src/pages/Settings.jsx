import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  User, Scissors, Settings as SettingsIcon, Save, Trash2, Plus, Edit2, ShieldAlert,
  X, Camera, Calendar, Clock, Percent, CreditCard, Check, Ban
} from 'lucide-react';

const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WEEKDAY_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
import SettingsMobileView from './SettingsMobileView';
import SettingsNotificationsSection from '../components/SettingsNotificationsSection';
import PublicCustomerLinkField from '../components/PublicCustomerLinkField';
import BusinessBrandingForm from '../components/business/BusinessBrandingForm';
import { compressImageFileToDataUrl } from '../utils/compressImageFile';
import { getStaffStatusColors } from '../utils/staffStatus';
import { SETTINGS_TABS, MOBILE_MQ, ICON_BLACK, ICON_STROKE } from './settingsConstants';

/** Corpo do PUT /barbers/:id — só campos aceitos pelo servidor (evita chaves extras do objeto barbeiro). */
function buildBarberUpdateBody(state) {
  let permissions = state.permissions;
  if (!Array.isArray(permissions)) {
    permissions = [];
    if (typeof state.permissions === 'string') {
      try {
        const p = JSON.parse(state.permissions);
        if (Array.isArray(p)) permissions = p;
      } catch {
        /* ignore */
      }
    }
  }
  const commissionRaw = state.commission;
  let commission;
  if (commissionRaw !== '' && commissionRaw != null) {
    const n = Number(commissionRaw);
    if (Number.isFinite(n)) commission = n;
  }
  const shifts = Array.isArray(state.shifts)
    ? state.shifts.map((s) => ({
        dia_semana: Number(s.dia_semana),
        hora_inicio: String(s.hora_inicio ?? '09:00'),
        hora_fim: String(s.hora_fim ?? '18:00'),
        almoco_inicio: String(s.almoco_inicio ?? '12:00'),
        almoco_fim: String(s.almoco_fim ?? '13:00'),
        ativo: s.ativo !== false && s.ativo !== 'false',
      }))
    : [];

  const body = {
    name: state.name,
    email: state.email,
    role: state.role,
    status: state.status,
    acceptsAppointments: state.acceptsAppointments !== false,
    whatsapp: state.whatsapp || undefined,
    chave_pix: state.chave_pix || undefined,
    data_admissao: state.data_admissao || undefined,
    permissions,
    shifts,
  };
  if (state.role === 'Gerente') delete body.shifts;
  if (commission !== undefined) body.commission = commission;
  if (state.foto_perfil != null && state.foto_perfil !== '') {
    body.foto_perfil = state.foto_perfil;
  }
  return body;
}

const Settings = () => {
  const { 
    barbers, addBarber, updateBarber, removeBarber, 
    services, addService, updateService, removeService, 
    businessInfo, updateBusinessInfo,
    fetchBarberScheduleBlocks, createBarberScheduleBlock, deleteBarberScheduleBlock,
    apiFetch, tenantSlug, token,
  } = useApp();
  
  const [activeTab, setActiveTab] = useState('barbers');
  
  // Modal State
  const [isBarberModalOpen, setIsBarberModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [barberToDelete, setBarberToDelete] = useState(null);
  const [editingBarberId, setEditingBarberId] = useState(null);
  const [changeBarberPassword, setChangeBarberPassword] = useState(false);

  const defaultShifts = [1,2,3,4,5].map(d => ({ dia_semana: d, hora_inicio: '09:00', hora_fim: '18:00', almoco_inicio: '12:00', almoco_fim: '13:00', ativo: true }));
  
  const initialBarberState = { 
    name: '', role: 'Barbeiro', email: '', password: '', passwordConfirm: '',
    foto_perfil: '', whatsapp: '',
    commission: 50, chave_pix: '', data_admissao: new Date().toISOString().split('T')[0],
    shifts: defaultShifts, status: 'Ativo', acceptsAppointments: true
  };

  const [newBarber, setNewBarber] = useState(initialBarberState);
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [isServiceFormOpen, setIsServiceFormOpen] = useState(false);
  
  const [newService, setNewService] = useState({ name: '', duration: '30 min', price: '', commissionPct: '50' });
  const [bInfo, setBInfo] = useState(businessInfo);
  const [saving, setSaving] = useState(false);
  const [scheduleBlocks, setScheduleBlocks] = useState([]);
  const [blockForm, setBlockForm] = useState({
    date: '',
    fullDay: true,
    startTime: '14:00',
    endTime: '19:00',
    reason: '',
  });
  const [blockSaving, setBlockSaving] = useState(false);

  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_MQ).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const fn = () => setIsMobile(mq.matches);
    fn();
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  useEffect(() => {
    if (businessInfo && Object.keys(businessInfo).length > 0) {
      setBInfo(businessInfo);
    }
  }, [businessInfo]);

  const handleAddBarber = async () => {
    if (!newBarber.name) return alert("O nome é obrigatório.");
    if (!newBarber.email) return alert("O e-mail é obrigatório.");
    
    let ok = false;
    if (editingBarberId) {
      const pwd = String(newBarber.password || '').trim();
      const pwd2 = String(newBarber.passwordConfirm || '').trim();
      if (changeBarberPassword) {
        if (!pwd) return alert('Informe a nova senha.');
        if (pwd !== pwd2) return alert('As senhas não coincidem.');
      }
      const payload = buildBarberUpdateBody(newBarber);
      if (changeBarberPassword && pwd) payload.password = pwd;
      ok = await updateBarber(editingBarberId, payload);
    } else {
      if (!newBarber.password) return alert("A senha é obrigatória.");
      const { passwordConfirm, ...toCreate } = newBarber;
      ok = await addBarber(toCreate);
    }
    if (ok) closeBarberModal();
  };

  const openBarberModal = async (barber = null) => {
    if (barber) {
      setEditingBarberId(barber.id);
      setChangeBarberPassword(false);
      const shiftsCopy =
        Array.isArray(barber.shifts) && barber.shifts.length > 0
          ? barber.shifts.map((s) => ({ ...s }))
          : defaultShifts.map((s) => ({ ...s }));
      setNewBarber({
        ...initialBarberState,
        ...barber,
        password: '',
        passwordConfirm: '',
        shifts: shiftsCopy,
      });
      const blocks = await fetchBarberScheduleBlocks(barber.id);
      setScheduleBlocks(blocks);
    } else {
      setEditingBarberId(null);
      setChangeBarberPassword(false);
      setNewBarber({
        ...initialBarberState,
        shifts: defaultShifts.map((s) => ({ ...s })),
      });
      setScheduleBlocks([]);
    }
    setBlockForm({
      date: new Date().toISOString().split('T')[0],
      fullDay: true,
      startTime: '14:00',
      endTime: '19:00',
      reason: '',
    });
    setIsBarberModalOpen(true);
  };

  const closeBarberModal = () => {
    setIsBarberModalOpen(false);
    setEditingBarberId(null);
    setChangeBarberPassword(false);
    setNewBarber(initialBarberState);
    setScheduleBlocks([]);
  };

  const toggleDay = (dia) => {
    setNewBarber(prev => {
      const currentShifts = prev.shifts || [];
      const exists = currentShifts.some(s => s.dia_semana === dia);
      if (exists) {
        return { ...prev, shifts: currentShifts.filter(s => s.dia_semana !== dia) };
      } else {
        return { ...prev, shifts: [...currentShifts, { dia_semana: dia, hora_inicio: '08:00', hora_fim: '19:00', almoco_inicio: '12:00', almoco_fim: '13:00', ativo: true }] };
      }
    });
  };

  const updateShiftTime = (dia, field, value) => {
    setNewBarber(prev => ({
      ...prev,
      shifts: prev.shifts.map(s => s.dia_semana === dia ? { ...s, [field]: value } : s)
    }));
  };

  const closeAfternoonForDay = (dia) => {
    setNewBarber((prev) => ({
      ...prev,
      shifts: prev.shifts.map((s) => {
        if (s.dia_semana !== dia) return s;
        const lunchStart = s.almoco_inicio || '12:00';
        return { ...s, hora_fim: lunchStart };
      }),
    }));
  };

  const handleAddScheduleBlock = async () => {
    if (!editingBarberId) {
      alert('Salve o profissional antes de adicionar bloqueios por data.');
      return;
    }
    if (!blockForm.date) return alert('Informe a data do fechamento.');
    setBlockSaving(true);
    const created = await createBarberScheduleBlock(editingBarberId, {
      date: blockForm.date,
      fullDay: blockForm.fullDay,
      startTime: blockForm.fullDay ? null : blockForm.startTime,
      endTime: blockForm.fullDay ? null : blockForm.endTime,
      reason: blockForm.reason || undefined,
    });
    setBlockSaving(false);
    if (created) {
      const blocks = await fetchBarberScheduleBlocks(editingBarberId);
      setScheduleBlocks(blocks);
    }
  };

  const handleRemoveScheduleBlock = async (blockId) => {
    if (!editingBarberId) return;
    const ok = await deleteBarberScheduleBlock(editingBarberId, blockId);
    if (ok) {
      const blocks = await fetchBarberScheduleBlocks(editingBarberId);
      setScheduleBlocks(blocks);
    }
  };

  const formatBlockLabel = (b) => {
    const d = b.date.split('-').reverse().join('/');
    if (!b.startTime && !b.endTime) return `${d} — dia inteiro`;
    return `${d} — ${b.startTime} às ${b.endTime}`;
  };

  // Rest of handler functions... (AddService, etc.)
  const resetServiceForm = () => {
    setNewService({ name: '', duration: '30 min', price: '', commissionPct: '50' });
    setEditingServiceId(null);
    setIsServiceFormOpen(false);
  };

  const handleAddService = () => {
    if (!newService.name || !newService.price) return;
    const serviceData = {
      ...newService,
      price: parseFloat(newService.price),
      commissionPct: Number(newService.commissionPct != null && newService.commissionPct !== ''
        ? newService.commissionPct
        : 50),
    };
    if (editingServiceId) { updateService(editingServiceId, serviceData); }
    else { addService(serviceData); }
    resetServiceForm();
  };

  const handleEditService = (service) => {
    setEditingServiceId(service.id);
    setNewService({
      name: service.name || '',
      duration: service.duration || '30 min',
      price: String(service.price ?? ''),
      commissionPct: String(service.commissionPct ?? 50),
    });
    setIsServiceFormOpen(true);
  };

  const handleDeleteService = async (service) => {
    const confirmed = window.confirm(`Deseja excluir o serviço "${service.name}"? Esta ação não pode ser desfeita.`);
    if (!confirmed) return;
    await removeService(service.id);
    if (editingServiceId === service.id) {
      resetServiceForm();
    }
  };

  const handleSaveBusinessInfo = async () => {
    try {
      setSaving(true);
      await updateBusinessInfo({
        name: bInfo.name,
        phone: bInfo.phone,
        email: bInfo.email,
        address: bInfo.address,
        logo_url: bInfo.logo_url,
        banner_url: bInfo.banner_url,
        tagline: String(bInfo.tagline ?? '').trim(),
        slogan: String(bInfo.slogan ?? '').trim(),
        instagram_url: String(bInfo.instagram_url ?? '').trim(),
        facebook_url: String(bInfo.facebook_url ?? '').trim(),
        whatsapp_url: String(bInfo.whatsapp_url ?? '').trim(),
        show_instagram: !!bInfo.show_instagram,
        show_facebook: !!bInfo.show_facebook,
        show_whatsapp: !!bInfo.show_whatsapp,
      });
      alert('Informações salvas!');
    } catch (e) {
      alert('Erro: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const openNewService = () => {
    setEditingServiceId(null);
    setNewService({ name: '', duration: '30 min', price: '', commissionPct: '50' });
    setIsServiceFormOpen(true);
  };

  const formatServicePrice = (price) =>
    `R$ ${Number(price).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const serviceFormBody = (
    <>
      <h3 className="set-mobile-modal__title">
        {editingServiceId ? 'Editar Serviço' : 'Novo Serviço'}
      </h3>
      <div className="set-mobile-form-stack">
        <input
          type="text"
          className="set-mobile-form-input"
          placeholder="Nome do serviço"
          value={newService.name}
          onChange={(e) => setNewService({ ...newService, name: e.target.value })}
        />
        <select
          className="set-mobile-form-input"
          value={newService.duration}
          onChange={(e) => setNewService({ ...newService, duration: e.target.value })}
        >
          {['30 min', '60 min', '90 min', '120 min'].map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <input
          type="number"
          className="set-mobile-form-input"
          placeholder="Preço (R$)"
          value={newService.price}
          onChange={(e) => setNewService({ ...newService, price: e.target.value })}
        />
        <input
          type="number"
          className="set-mobile-form-input"
          placeholder="Comissão do profissional (%)"
          min="0"
          max="100"
          value={newService.commissionPct}
          onChange={(e) => setNewService({ ...newService, commissionPct: e.target.value })}
        />
        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          Cada serviço pode ter uma % diferente (ex.: 40 = o profissional recebe 40%).
        </p>
      </div>
      <div className="set-mobile-modal__actions">
        <button type="button" className="set-mobile-modal__btn set-mobile-modal__btn--ghost" onClick={resetServiceForm}>
          Cancelar
        </button>
        <button type="button" className="set-mobile-modal__btn set-mobile-modal__btn--primary" onClick={handleAddService}>
          <Save size={18} strokeWidth={ICON_STROKE} color={ICON_BLACK} />
          {editingServiceId ? 'Salvar' : 'Salvar Serviço'}
        </button>
      </div>
    </>
  );

  return (
    <div className={`settings-page fade-in${isMobile ? ' settings-page--mobile' : ''}`}>
      {!isMobile && (
        <header className="settings-desktop-header">
          <h1>Configurações do Sistema</h1>
          <p>Gerencie a equipe, catálogo e perfil do negócio.</p>
        </header>
      )}

      {/* BARBER MODAL */}
      {isBarberModalOpen && (
        <div className="modal-backdrop" style={{ padding: '1.25rem' }}>
          <div className="modal-glass-panel settings-barber-modal fade-in" style={{ width: '100%', maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto', color: 'var(--text-primary)', position: 'relative', padding: '0' }}>
            
            {/* Modal Header */}
            <div style={{ padding: '2rem 2.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'var(--glass-bg)', backdropFilter: 'var(--glass-blur)', WebkitBackdropFilter: 'var(--glass-blur)', zIndex: 10 }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, fontFamily: 'Outfit' }}>{editingBarberId ? 'Editar Profissional' : 'Novo Barbeiro'}</h2>
              <button
                type="button"
                className="settings-barber-modal-close-btn"
                onClick={closeBarberModal}
                aria-label="Fechar"
                title="Fechar"
                style={{ background: 'var(--icon-bg)', cursor: 'pointer', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--icon-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--icon-bg)'}
              >
                <X size={20} strokeWidth={ICON_STROKE} color={ICON_BLACK} aria-hidden />
              </button>
            </div>
            <div className="settings-barber-modal-body" style={{ padding: '2.5rem' }}>
              
              {/* Top Section: Photo & Identity */}
              <div className="settings-barber-photo-grid" style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '2rem', marginBottom: '2.5rem' }}>
                <div 
                  onClick={() => document.getElementById('barberPhoto').click()}
                  style={{ width: '150px', height: '150px', borderRadius: '16px', border: '1px solid var(--card-outline)', background: '#ffffff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', transition: 'all 0.2s' }}
                >
                  {newBarber.foto_perfil ? (
                    <img
                      key={`preview-${newBarber.foto_perfil.length}`}
                      src={newBarber.foto_perfil}
                      alt="Preview"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <>
                      <Camera size={28} style={{ color: 'var(--text-secondary)', marginBottom: '8px' }} />
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600 }}>CARREGAR FOTO</span>
                    </>
                  )}
                  <input id="barberPhoto" type="file" accept="image/*" hidden onChange={async (e) => {
                    const file = e.target.files[0];
                    if (file) {
                      try {
                        const dataUrl = await compressImageFileToDataUrl(file);
                        setNewBarber((prev) => ({ ...prev, foto_perfil: dataUrl }));
                      } catch {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setNewBarber((prev) => ({ ...prev, foto_perfil: reader.result }));
                        };
                        reader.readAsDataURL(file);
                      }
                    }
                    e.target.value = '';
                  }} />
                </div>
                <div style={{ display: 'grid', gap: '1.25rem' }}>
                  <div style={{ position: 'relative' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>Nome completo *</label>
                    <input type="text" placeholder="Ex: Roberto Silva" value={newBarber.name} onChange={e => setNewBarber({...newBarber, name: e.target.value})} style={{ width: '100%', padding: '14px', background: 'var(--panel-bg)', border: '1px solid var(--card-outline)', borderRadius: '12px', color: 'var(--text-primary)', outline: 'none', transition: 'all 0.2s' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>WhatsApp</label>
                    <input type="text" placeholder="(11) 99999-9999" value={newBarber.whatsapp} onChange={e => setNewBarber({...newBarber, whatsapp: e.target.value})} style={{ width: '100%', padding: '14px', background: 'var(--panel-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-primary)', outline: 'none' }} />
                  </div>
                </div>
              </div>

              {/* Acesso ao portal */}
              <div style={{ marginBottom: '2.5rem' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '12px' }}>Acesso ao portal</label>
                {!editingBarberId ? (
                  <div className="settings-barber-access-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>E-mail de acesso *</label>
                      <input type="email" placeholder="nome@barbearia.com" value={newBarber.email} onChange={e => setNewBarber({ ...newBarber, email: e.target.value })} style={{ width: '100%', padding: '14px', background: 'var(--panel-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-primary)', outline: 'none' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Senha de acesso *</label>
                      <input type="password" autoComplete="new-password" placeholder="Senha provisória" value={newBarber.password} onChange={e => setNewBarber({ ...newBarber, password: e.target.value })} style={{ width: '100%', padding: '14px', background: 'var(--panel-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-primary)', outline: 'none' }} />
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>E-mail de acesso *</label>
                      <input type="email" placeholder="nome@barbearia.com" value={newBarber.email} onChange={e => setNewBarber({ ...newBarber, email: e.target.value })} style={{ width: '100%', padding: '14px', background: 'var(--panel-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-primary)', outline: 'none' }} />
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: changeBarberPassword ? '1rem' : 0 }}>
                      <input
                        type="checkbox"
                        checked={changeBarberPassword}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setChangeBarberPassword(checked);
                          if (!checked) setNewBarber((prev) => ({ ...prev, password: '', passwordConfirm: '' }));
                        }}
                        style={{ width: '18px', height: '18px', accentColor: 'var(--accent-color)' }}
                      />
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>Alterar senha do barbeiro</span>
                    </label>
                    {changeBarberPassword && (
                      <div className="settings-barber-access-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                          <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Nova senha</label>
                          <input type="password" autoComplete="new-password" placeholder="Nova senha" value={newBarber.password} onChange={e => setNewBarber({ ...newBarber, password: e.target.value })} style={{ width: '100%', padding: '14px', background: 'var(--panel-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-primary)', outline: 'none' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Confirmar nova senha</label>
                          <input type="password" autoComplete="new-password" placeholder="Repita a nova senha" value={newBarber.passwordConfirm} onChange={e => setNewBarber({ ...newBarber, passwordConfirm: e.target.value })} style={{ width: '100%', padding: '14px', background: 'var(--panel-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-primary)', outline: 'none' }} />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
              {/* Carga horária — padrão semanal */}
              {newBarber.role === 'Gerente' ? (
                <div style={{ marginBottom: '2.5rem', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--card-outline)', background: 'var(--panel-bg)' }}>
                  <strong>Horário de atendimento do gerente</strong>
                  <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    O gerente usa automaticamente o horário geral configurado para a barbearia.
                  </p>
                </div>
              ) : <div style={{ marginBottom: '2.5rem' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>Carga horária (padrão semanal)</label>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 12px', lineHeight: 1.45 }}>
                  Marque os dias de atendimento e configure horários por dia. Use &quot;Fechar tarde&quot; para bloquear a tarde (ex.: quinta à tarde).
                </p>
                <div className="settings-weekday-row" style={{ marginBottom: '1rem' }}>
                  {WEEKDAY_SHORT.map((day, idx) => (
                    <button
                      type="button"
                      key={day}
                      className="settings-weekday-btn"
                      onClick={() => toggleDay(idx)}
                      style={{
                        border: '1px solid var(--card-outline)',
                        background: newBarber.shifts.some(s => s.dia_semana === idx) ? 'var(--accent-color)' : 'var(--panel-bg)',
                        color: newBarber.shifts.some(s => s.dia_semana === idx) ? 'var(--accent-text)' : 'var(--text-secondary)'
                      }}
                    >
                      {day}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {WEEKDAY_FULL.map((dayName, idx) => {
                    const shift = newBarber.shifts.find((s) => s.dia_semana === idx);
                    if (!shift) return null;
                    return (
                      <div
                        key={dayName}
                        style={{
                          padding: '14px',
                          borderRadius: '12px',
                          border: '1px solid var(--card-outline)',
                          background: 'var(--panel-bg)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{dayName}</span>
                          <button
                            type="button"
                            onClick={() => closeAfternoonForDay(idx)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '9999px',
                              border: '1px solid var(--card-outline)',
                              background: '#fff',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Fechar tarde
                          </button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                          {[
                            ['Entrada', 'hora_inicio'],
                            ['Saída', 'hora_fim'],
                            ['Almoço início', 'almoco_inicio'],
                            ['Almoço fim', 'almoco_fim'],
                          ].map(([label, field]) => (
                            <div key={field}>
                              <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>{label}</label>
                              <input
                                type="time"
                                value={shift[field] || ''}
                                onChange={(e) => updateShiftTime(idx, field, e.target.value)}
                                style={{ width: '100%', padding: '8px', background: 'var(--bg-color)', border: '1px solid var(--card-outline)', borderRadius: '8px', fontWeight: 600 }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>}

              {editingBarberId && (
                <div style={{ marginBottom: '2.5rem', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--card-outline)', background: 'var(--panel-bg)' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <Ban size={14} /> Horários fechados (datas específicas)
                  </label>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 14px' }}>
                    Folgas ou bloqueios pontuais que não seguem o padrão semanal.
                  </p>
                  {scheduleBlocks.length > 0 && (
                    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {scheduleBlocks.map((b) => (
                        <li
                          key={b.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            background: '#fff',
                            fontSize: '0.85rem',
                          }}
                        >
                          <span>
                            {formatBlockLabel(b)}
                            {b.reason ? <span style={{ color: 'var(--text-secondary)' }}> — {b.reason}</span> : null}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveScheduleBlock(b.id)}
                            style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}
                          >
                            Remover
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                    <div>
                      <label style={{ fontSize: '0.7rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Data</label>
                      <input
                        type="date"
                        value={blockForm.date}
                        onChange={(e) => setBlockForm((f) => ({ ...f, date: e.target.value }))}
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--card-outline)' }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={blockForm.fullDay}
                          onChange={(e) => setBlockForm((f) => ({ ...f, fullDay: e.target.checked }))}
                        />
                        Dia inteiro fechado
                      </label>
                    </div>
                  </div>
                  {!blockForm.fullDay && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                      <div>
                        <label style={{ fontSize: '0.7rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Das</label>
                        <input
                          type="time"
                          value={blockForm.startTime}
                          onChange={(e) => setBlockForm((f) => ({ ...f, startTime: e.target.value }))}
                          style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--card-outline)' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.7rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Até</label>
                        <input
                          type="time"
                          value={blockForm.endTime}
                          onChange={(e) => setBlockForm((f) => ({ ...f, endTime: e.target.value }))}
                          style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--card-outline)' }}
                        />
                      </div>
                    </div>
                  )}
                  <input
                    type="text"
                    placeholder="Motivo (opcional)"
                    value={blockForm.reason}
                    onChange={(e) => setBlockForm((f) => ({ ...f, reason: e.target.value }))}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--card-outline)', marginBottom: '10px' }}
                  />
                  <button
                    type="button"
                    disabled={blockSaving}
                    onClick={handleAddScheduleBlock}
                    style={{
                      padding: '12px 18px',
                      borderRadius: '9999px',
                      border: '1px solid var(--card-outline)',
                      background: 'var(--accent-color)',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {blockSaving ? 'Salvando…' : 'Adicionar fechamento'}
                  </button>
                </div>
              )}
              {/* Finance & Aditional info */}
              <div className="settings-barber-finance-grid" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.25rem', marginBottom: '2.5rem' }}>
                 <div>
                   <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>Chave PIX (Pagamentos)</label>
                   <input type="text" placeholder="CPF ou Chave Aleatória" value={newBarber.chave_pix} onChange={e => setNewBarber({...newBarber, chave_pix: e.target.value})} style={{ width: '100%', padding: '14px', background: 'var(--panel-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-primary)' }} />
                 </div>
                 <div>
                   <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>Admissão</label>
                   <input type="date" value={newBarber.data_admissao} onChange={e => setNewBarber({...newBarber, data_admissao: e.target.value})} style={{ width: '100%', padding: '14px', background: 'var(--panel-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-primary)' }} />
                 </div>
              </div>
              <p style={{ margin: '-1.5rem 0 2rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                A comissão do profissional é definida por serviço (Configurações → Serviços ou Financeiro → Equipe → Taxas).
              </p>
              {/* Status Toggle */}
              <div className="settings-barber-status-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', background: 'var(--panel-bg)', borderRadius: '16px', border: '1px solid var(--card-outline)', marginBottom: '1rem' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    {newBarber.role === 'Gerente' ? 'Também realizo atendimentos' : 'Participa da agenda'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {newBarber.acceptsAppointments !== false ? 'Aparece como opção nos agendamentos' : 'Não aparece na agenda, mas mantém o acesso ao sistema'}
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={newBarber.acceptsAppointments !== false}
                  onClick={() => setNewBarber({ ...newBarber, acceptsAppointments: newBarber.acceptsAppointments === false })}
                  style={{ border: 0, width: '56px', height: '28px', background: newBarber.acceptsAppointments !== false ? 'var(--accent-color)' : 'var(--brand-300)', borderRadius: '14px', position: 'relative', cursor: 'pointer', transition: 'all 0.3s' }}
                >
                  <span style={{ width: '22px', height: '22px', background: '#fff', borderRadius: '50%', position: 'absolute', top: '3px', left: newBarber.acceptsAppointments !== false ? '31px' : '3px', transition: 'all 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
                </button>
              </div>
              <div className="settings-barber-status-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', background: 'var(--panel-bg)', borderRadius: '16px', border: '1px solid var(--card-outline)', marginBottom: '3rem' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Status do Profissional</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{newBarber.status === 'Ativo' ? 'Disponível para novos agendamentos' : 'Temporariamente indisponível'}</div>
                </div>
                <div 
                  onClick={() => setNewBarber({...newBarber, status: newBarber.status === 'Ativo' ? 'Suspenso' : 'Ativo'})}
                  style={{ width: '56px', height: '28px', background: newBarber.status === 'Ativo' ? 'var(--accent-color)' : 'var(--brand-300)', borderRadius: '14px', position: 'relative', cursor: 'pointer', transition: 'all 0.3s' }}
                >
                  <div style={{ width: '22px', height: '22px', background: '#fff', borderRadius: '50%', position: 'absolute', top: '3px', left: newBarber.status === 'Ativo' ? '31px' : '3px', transition: 'all 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
                </div>
              </div>
              {/* Footer Buttons */}
              <div className="settings-barber-modal-footer" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', paddingTop: '1rem' }}>
                <button 
                  onClick={closeBarberModal}
                  style={{ padding: '18px', borderRadius: '9999px', border: '1px solid var(--card-outline)', background: '#fff', color: '#000', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--panel-bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleAddBarber}
                  style={{ padding: '18px', borderRadius: '9999px', border: '1px solid var(--card-outline)', background: 'var(--accent-color)', color: 'var(--accent-text)', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  {editingBarberId ? 'Salvar Edição' : 'Concluir Cadastro'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {isDeleteModalOpen && (
        <div className="modal-backdrop" style={{ padding: '1.25rem' }}>
          <div className="modal-glass-panel scale-in" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem', textAlign: 'center' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
              <ShieldAlert size={30} />
            </div>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '10px' }}>Excluir Profissional?</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '2rem' }}>
              Você está prestes a remover <strong>{barberToDelete?.name}</strong>. Esta ação não pode ser desfeita.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <button 
                onClick={() => { setIsDeleteModalOpen(false); setBarberToDelete(null); }}
                style={{ padding: '12px', borderRadius: '9999px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button 
                onClick={async () => {
                  await removeBarber(barberToDelete.id);
                  setIsDeleteModalOpen(false);
                  setBarberToDelete(null);
                }}
                style={{ padding: '12px', borderRadius: '9999px', border: 'none', background: '#ef4444', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {isMobile && isServiceFormOpen && (
        <div className="modal-backdrop set-mobile-modal-backdrop">
          <div className="modal-glass-panel set-mobile-modal-panel fade-in">
            <button
              type="button"
              className="set-mobile-modal-close settings-action-icon-btn"
              onClick={resetServiceForm}
              aria-label="Fechar"
            >
              <X size={20} strokeWidth={ICON_STROKE} color={ICON_BLACK} />
            </button>
            {serviceFormBody}
          </div>
        </div>
      )}

      {isMobile ? (
        <SettingsMobileView
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          barbers={barbers}
          services={services}
          openBarberModal={openBarberModal}
          onDeleteBarber={(b) => {
            setBarberToDelete(b);
            setIsDeleteModalOpen(true);
          }}
          openNewService={openNewService}
          onEditService={handleEditService}
          onDeleteService={handleDeleteService}
          formatServicePrice={formatServicePrice}
          bInfo={bInfo}
          setBInfo={setBInfo}
          onSaveBusiness={handleSaveBusinessInfo}
          saving={saving}
          apiFetch={apiFetch}
          tenantSlug={tenantSlug}
          isStaffSession={Boolean(token)}
        />
      ) : (
      <div className="settings-desktop-grid">
        
        {/* Sidebar Menu */}
        <div className="settings-desktop-sidebar">
          {SETTINGS_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`settings-desktop-tab${activeTab === t.id ? ' settings-desktop-tab--active' : ''}`}
            >
              <t.icon size={18} /> {t.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="glass-card" style={{ padding: '2.5rem', minHeight: '500px' }}>
          
          {activeTab === 'barbers' && (
            <div className="fade-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>Corpo Técnico</h2>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Gerencie sua equipe de barbeiros</p>
                </div>
                <button className="btn-primary" onClick={() => openBarberModal()} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}>
                  <Plus size={18} /> Novo Barbeiro
                </button>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                {barbers.map(b => (
                  <div key={b.id} className="glass-card hover-trigger settings-catalog-card" style={{ padding: '1.5rem', position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                      <div style={{ width: '60px', height: '60px', borderRadius: '12px', background: 'var(--panel-bg)', overflow: 'hidden' }}>
                        {b.foto_perfil ? <img src={b.foto_perfil} alt={b.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.2rem' }}>{b.name.charAt(0)}</div>}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{b.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {b.role} •{' '}
                          <span style={{ color: getStaffStatusColors(b.status).text, fontWeight: 600 }}>{b.status}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="settings-card-actions" style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
                      <button type="button" className="settings-card-action-btn--plain" onClick={() => openBarberModal(b)} style={{ flex: 1, padding: '8px', borderRadius: '9999px', background: 'var(--panel-bg)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.8rem' }}>
                        <Edit2 size={14} /> Editar
                      </button>
                      <button type="button" className="settings-card-action-btn--delete" onClick={() => { setBarberToDelete(b); setIsDeleteModalOpen(true); }} style={{ padding: '8px', borderRadius: '9999px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Rest of Tabs (Services, Products, Business) keep their original logic but styled as cards */}
          {activeTab === 'services' && (
            <div className="fade-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>Catálogo de Serviços</h2>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Organize e atualize seus serviços com preços e duração.</p>
                </div>
                <button
                  className="btn-primary"
                  onClick={openNewService}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}
                >
                  <Plus size={18} /> Novo Serviço
                </button>
              </div>

              {isServiceFormOpen && (
                <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', margin: '0 0 1rem 0' }}>{editingServiceId ? 'Editar Serviço' : 'Novo Serviço'}</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '10px' }}>
                    <input type="text" placeholder="Nome do serviço" value={newService.name} onChange={e => setNewService({...newService, name: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--panel-bg)', color: 'var(--text-primary)' }} />
                    <select value={newService.duration} onChange={e => setNewService({...newService, duration: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--panel-bg)', color: 'var(--text-primary)' }}>
                      {['30 min', '60 min', '90 min', '120 min'].map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <input type="number" placeholder="Preço (R$)" value={newService.price} onChange={e => setNewService({...newService, price: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--panel-bg)', color: 'var(--text-primary)' }} />
                    <input type="number" placeholder="Comissão do profissional (%)" min="0" max="100" value={newService.commissionPct} onChange={e => setNewService({...newService, commissionPct: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--panel-bg)', color: 'var(--text-primary)' }} title="Percentual que o profissional recebe neste serviço" />
                  </div>
                  <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Cada serviço pode ter uma % diferente de comissão do profissional.
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1rem' }}>
                    <button onClick={resetServiceForm} style={{ padding: '10px 14px', borderRadius: '9999px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>
                      Cancelar
                    </button>
                    <button className="btn-primary" onClick={handleAddService} style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Save size={16} /> {editingServiceId ? 'Salvar Edição' : 'Salvar Serviço'}
                    </button>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.5rem' }}>
                {services.map(s => (
                  <div key={s.id} className="glass-card hover-trigger settings-catalog-card" style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '4px' }}>{s.name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {s.duration} · Comissão profissional {Number(s.commissionPct ?? 50)}%
                        </div>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '1rem' }}>R$ {Number(s.price).toFixed(2)}</div>
                    </div>
                    <div className="settings-card-actions" style={{ display: 'flex', gap: '10px' }}>
                      <button type="button" className="settings-card-action-btn--plain" onClick={() => handleEditService(s)} style={{ flex: 1, padding: '8px', borderRadius: '9999px', background: 'var(--panel-bg)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.8rem' }}>
                        <Edit2 size={14} /> Editar
                      </button>
                      <button type="button" className="settings-card-action-btn--delete" onClick={() => handleDeleteService(s)} style={{ padding: '8px', borderRadius: '9999px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {services.length === 0 && (
                <div style={{ marginTop: '1.5rem', padding: '1.25rem', borderRadius: '12px', background: 'var(--panel-bg)', color: 'var(--text-secondary)' }}>
                  Nenhum serviço cadastrado ainda. Clique em "Novo Serviço" para começar.
                </div>
              )}
            </div>
          )}

          {activeTab === 'business' && (
            <div className="fade-in">
              <h2 style={{ fontSize: '1.3rem', marginBottom: '2rem' }}>Perfil do Negócio</h2>
              <div style={{ maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <BusinessBrandingForm bInfo={bInfo} setBInfo={setBInfo} />

                <PublicCustomerLinkField />

                <div style={{ paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                  <h3 style={{ fontSize: '1rem', marginBottom: '12px', fontWeight: 700 }}>Redes sociais (página de agendamento)</h3>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                    Preencha o link ou identificador e marque se deve aparecer para os clientes na reserva online.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--panel-bg)' }}>
                      <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px', fontSize: '0.9rem' }}>Instagram</label>
                      <input
                        type="text"
                        value={bInfo.instagram_url || ''}
                        onChange={(e) => setBInfo({ ...bInfo, instagram_url: e.target.value })}
                        placeholder="https://instagram.com/sua_pagina ou @usuario"
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '10px' }}
                      />
                      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.88rem' }}>
                        <input type="checkbox" checked={!!bInfo.show_instagram} onChange={(e) => setBInfo({ ...bInfo, show_instagram: e.target.checked })} />
                        Mostrar na página pública de agendamento
                      </label>
                    </div>

                    <div style={{ padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--panel-bg)' }}>
                      <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px', fontSize: '0.9rem' }}>WhatsApp</label>
                      <input
                        type="text"
                        value={bInfo.whatsapp_url || ''}
                        onChange={(e) => setBInfo({ ...bInfo, whatsapp_url: e.target.value })}
                        placeholder="DDD + número ou link https://wa.me/5511999999999"
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '10px' }}
                      />
                      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.88rem' }}>
                        <input type="checkbox" checked={!!bInfo.show_whatsapp} onChange={(e) => setBInfo({ ...bInfo, show_whatsapp: e.target.checked })} />
                        Mostrar na página pública de agendamento
                      </label>
                    </div>

                    <div style={{ padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--panel-bg)' }}>
                      <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px', fontSize: '0.9rem' }}>Facebook</label>
                      <input
                        type="text"
                        value={bInfo.facebook_url || ''}
                        onChange={(e) => setBInfo({ ...bInfo, facebook_url: e.target.value })}
                        placeholder="https://facebook.com/sua_pagina ou nome da página"
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '10px' }}
                      />
                      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.88rem' }}>
                        <input type="checkbox" checked={!!bInfo.show_facebook} onChange={(e) => setBInfo({ ...bInfo, show_facebook: e.target.checked })} />
                        Mostrar na página pública de agendamento
                      </label>
                    </div>
                  </div>
                </div>

                <button type="button" className="btn-primary" onClick={handleSaveBusinessInfo} style={{ padding: '14px', marginTop: '4px' }} disabled={saving}>
                  {saving ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <SettingsNotificationsSection
              apiFetch={apiFetch}
              tenantSlug={tenantSlug}
              isStaffSession={Boolean(token)}
              variant="desktop"
            />
          )}
        </div>
      </div>
      )}
    </div>
  );
};

export default Settings;


