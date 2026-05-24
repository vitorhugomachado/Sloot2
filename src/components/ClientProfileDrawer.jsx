import React, { useEffect, useState } from 'react';
import { X, Phone, Mail, Cake, Calendar, Edit2, Trash2, UserPlus } from 'lucide-react';
import WhatsAppIcon from './icons/WhatsAppIcon';

const formatPhoneDisplay = (raw) => {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
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

const statusColors = {
  Agendado: { bg: 'rgba(255, 106, 0, 0.12)', color: '#FF6A00' },
  Confirmado: { bg: 'rgba(255, 106, 0, 0.18)', color: '#FF6A00' },
  Finalizado: { bg: 'rgba(34,197,94,0.15)', color: '#16a34a' },
  Concluido: { bg: 'rgba(34,197,94,0.15)', color: '#16a34a' },
  Cancelado: { bg: 'rgba(220,38,38,0.12)', color: '#dc2626' },
  Pendente: { bg: 'rgba(234,179,8,0.18)', color: '#a16207' }
};

const ClientProfileDrawer = ({ client, history, onClose, onSave, onDelete, onPromote, onSchedule, onEdit, saving }) => {
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (client) {
      setNotes(client.notes || '');
      setTags(Array.isArray(client.tags) ? client.tags : []);
      setDirty(false);
    }
  }, [client]);

  if (!client) return null;

  const isGuest = client.source === 'guest';
  const phoneDigits = String(client.phone || '').replace(/\D/g, '');
  const waLink = phoneDigits
    ? `https://wa.me/55${phoneDigits}?text=${encodeURIComponent(`Olá ${client.name}!`)}`
    : null;

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (!trimmed || tags.includes(trimmed)) {
      setTagInput('');
      return;
    }
    setTags([...tags, trimmed]);
    setTagInput('');
    setDirty(true);
  };

  const handleRemoveTag = (tag) => {
    setTags(tags.filter((t) => t !== tag));
    setDirty(true);
  };

  const handleSave = async () => {
    if (isGuest) return;
    await onSave({ notes, tags });
    setDirty(false);
  };

  return (
    <div className="modal-backdrop modal-backdrop--drawer" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-glass-panel"
        style={{
          width: '100%',
          maxWidth: '560px',
          height: '100%',
          padding: '1.75rem',
          overflowY: 'auto',
          borderRadius: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
              <h2 style={{ fontSize: '1.4rem', margin: 0 }}>{client.name}</h2>
              <span style={{
                padding: '2px 10px',
                borderRadius: '12px',
                fontSize: '0.7rem',
                fontWeight: 600,
                background: isGuest ? 'rgba(234,179,8,0.18)' : 'rgba(34,197,94,0.15)',
                color: isGuest ? '#a16207' : '#16a34a'
              }}>
                {isGuest ? 'Não cadastrado' : 'Cadastrado'}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              {client.phone && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Phone size={14} /> {formatPhoneDisplay(client.phone)}
                </span>
              )}
              {client.email && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Mail size={14} /> {client.email}
                </span>
              )}
              {client.birthday && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Cake size={14} /> {formatDate(client.birthday)}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="dash-icon-btn" style={{ background: 'none' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noreferrer"
              className="wa-btn"
            >
              <WhatsAppIcon size={14} /> WhatsApp
            </a>
          )}
          <button
            onClick={() => onSchedule?.(client)}
            className="btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
          >
            <Calendar size={14} /> Agendar
          </button>
          {isGuest ? (
            <button
              onClick={() => onPromote?.(client)}
              className="btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
            >
              <UserPlus size={14} /> Cadastrar
            </button>
          ) : (
            <>
              <button
                onClick={() => onEdit?.(client)}
                className="btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
              >
                <Edit2 size={14} /> Editar
              </button>
              <button
                onClick={() => onDelete?.(client)}
                className="btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#dc2626' }}
              >
                <Trash2 size={14} /> Excluir
              </button>
            </>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
          <KpiBox label="Total gasto" value={formatCurrency(client.totalSpent)} />
          <KpiBox label="Visitas" value={client.visitCount || 0} />
          <KpiBox label="Ticket médio" value={formatCurrency(client.averageTicket)} />
          <KpiBox label="Última visita" value={formatDate(client.lastVisit)} />
        </div>

        {client.nextAppointment && (
          <div className="glass-card" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>Próximo agendamento</div>
              <div style={{ fontWeight: 600 }}>
                {formatDate(client.nextAppointment.date)} • {client.nextAppointment.time} — {client.nextAppointment.service}
              </div>
            </div>
          </div>
        )}

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tags</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
            {tags.map((tag) => (
              <span
                key={tag}
                style={{
                  padding: '4px 10px',
                  background: 'rgba(0,0,0,0.05)',
                  borderRadius: '14px',
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {tag}
                {!isGuest && (
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    style={{ background: 'none', padding: 0, border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}
                  >
                    <X size={12} />
                  </button>
                )}
              </span>
            ))}
            {tags.length === 0 && (
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Nenhuma tag.</span>
            )}
          </div>
          {!isGuest && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                placeholder="Nova tag"
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.85rem',
                  outline: 'none',
                  background: 'rgba(0,0,0,0.01)'
                }}
              />
              <button type="button" onClick={handleAddTag} className="btn-secondary" style={{ fontSize: '0.85rem' }}>
                Adicionar
              </button>
            </div>
          )}
        </div>

        <div>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Anotações</span>
          {isGuest ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
              Cadastre o cliente para registrar anotações.
            </p>
          ) : (
            <>
              <textarea
                value={notes}
                onChange={(e) => { setNotes(e.target.value); setDirty(true); }}
                placeholder="Preferências, alergias, observações..."
                style={{
                  width: '100%',
                  minHeight: '90px',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.9rem',
                  outline: 'none',
                  background: 'rgba(0,0,0,0.01)',
                  marginTop: '8px',
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSave}
                  disabled={!dirty || saving}
                  style={{ fontSize: '0.85rem' }}
                >
                  {saving ? 'Salvando...' : 'Salvar alterações'}
                </button>
              </div>
            </>
          )}
        </div>

        <div>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Histórico ({history?.length || 0})
          </span>
          <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {(!history || history.length === 0) && (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Sem agendamentos registrados.</p>
            )}
            {history?.map((appt) => {
              const tone = statusColors[appt.status] || { bg: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)' };
              return (
                <div
                  key={appt.id}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: '8px',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{appt.service}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {formatDate(appt.date)} às {appt.time} · {appt.Barber?.name || 'Profissional'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{formatCurrency(appt.price)}</div>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      background: tone.bg,
                      color: tone.color
                    }}>{appt.status}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

const KpiBox = ({ label, value }) => (
  <div className="glass-card" style={{ padding: '12px 14px' }}>
    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
    <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '4px' }}>{value}</div>
  </div>
);

export default ClientProfileDrawer;
