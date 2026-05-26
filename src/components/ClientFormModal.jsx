import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '10px',
  border: '1px solid var(--border-color)',
  fontSize: '0.9rem',
  outline: 'none',
  background: 'rgba(0,0,0,0.01)',
  color: 'var(--text-primary)'
};

const labelStyle = {
  display: 'block',
  fontSize: '0.78rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--text-secondary)',
  marginBottom: '6px',
  fontWeight: 600
};

const formatPhone = (raw) => {
  const digits = String(raw || '').replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const ClientFormModal = ({ open, mode = 'create', initialData, onClose, onSubmit }) => {
  const [form, setForm] = useState({ name: '', phone: '', email: '', birthday: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setForm({
        name: initialData?.name || '',
        phone: initialData?.phone || '',
        email: initialData?.email || '',
        birthday: initialData?.birthday || '',
        notes: initialData?.notes || '',
      });
      setError(null);
    }
  }, [open, initialData]);

  if (!open) return null;

  const handleField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim() || !form.phone.trim()) {
      setError('Nome e telefone são obrigatórios');
      return;
    }
    try {
      setSubmitting(true);
      await onSubmit({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        birthday: form.birthday || null,
        notes: form.notes.trim() || null,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Erro ao salvar');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-glass-panel client-form-modal fade-in"
        style={{ width: '100%', maxWidth: '520px', padding: '1.75rem', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.3rem', margin: 0 }}>
              {mode === 'edit' ? 'Editar Cliente' : 'Novo Cliente'}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '4px 0 0' }}>
              {mode === 'edit' ? 'Atualize os dados do cliente.' : 'Cadastre um cliente sem precisar de portal.'}
            </p>
          </div>
          <button onClick={onClose} className="dash-icon-btn" style={{ background: 'none' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Nome *</label>
            <input
              style={inputStyle}
              value={form.name}
              onChange={(e) => handleField('name', e.target.value)}
              placeholder="Nome completo"
              autoFocus
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Telefone *</label>
              <input
                style={inputStyle}
                value={formatPhone(form.phone)}
                onChange={(e) => handleField('phone', e.target.value.replace(/\D/g, ''))}
                placeholder="(11) 99999-9999"
              />
            </div>
            <div>
              <label style={labelStyle}>Aniversário</label>
              <input
                type="date"
                style={inputStyle}
                value={form.birthday || ''}
                onChange={(e) => handleField('birthday', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>E-mail</label>
            <input
              style={inputStyle}
              value={form.email}
              onChange={(e) => handleField('email', e.target.value)}
              placeholder="cliente@exemplo.com"
              type="email"
            />
          </div>

          <div>
            <label style={labelStyle}>Anotações</label>
            <textarea
              style={{ ...inputStyle, minHeight: '90px', resize: 'vertical', fontFamily: 'inherit' }}
              value={form.notes}
              onChange={(e) => handleField('notes', e.target.value)}
              placeholder="Preferências, observações sobre cortes..."
            />
          </div>

          {error && (
            <div style={{
              padding: '10px 12px',
              borderRadius: '10px',
              background: 'rgba(220,38,38,0.1)',
              color: '#dc2626',
              fontSize: '0.85rem'
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '0.5rem' }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Salvando...' : mode === 'edit' ? 'Salvar' : 'Cadastrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClientFormModal;
