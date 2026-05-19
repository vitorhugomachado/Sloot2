import React, { useState } from 'react';
import { Phone, LogOut } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { isValidPhone, normalizePhone, PHONE_ERROR } from '../utils/phone';
import StripedMotionButton from './StripedMotionButton';

const CompleteProfileGate = () => {
  const { currentCustomer, updateCustomerProfile, customerLogout } = useApp();
  const [name, setName] = useState(currentCustomer?.name || '');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const trimmedName = (name || '').trim();
    if (!trimmedName) {
      setError('Informe o seu nome.');
      return;
    }
    if (!isValidPhone(phone)) {
      setError(PHONE_ERROR);
      return;
    }
    try {
      setSubmitting(true);
      await updateCustomerProfile({ name: trimmedName, phone: normalizePhone(phone) });
    } catch (err) {
      setError(err.message || 'Não foi possível salvar o perfil.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="modal-backdrop modal-backdrop--elevated"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="complete-profile-title"
    >
      <div
        className="modal-glass-panel fade-in"
        style={{ width: '100%', maxWidth: '440px', padding: '2rem' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.25rem' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'var(--brand-50)',
              color: 'var(--brand-700)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Phone size={22} />
          </div>
          <div>
            <h2 id="complete-profile-title" style={{ fontSize: '1.15rem', margin: 0 }}>
              Completa o teu perfil
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              Precisamos do teu telefone para confirmar agendamentos.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Nome</span>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', outline: 'none' }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Telefone</span>
            <input
              type="tel"
              required
              inputMode="numeric"
              autoComplete="tel"
              placeholder="(DDD) 00000-0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', outline: 'none' }}
            />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              DDD + número (10 ou 11 dígitos). Ex.: 11912345678.
            </span>
          </label>

          {error && (
            <p style={{ color: '#ef4444', fontSize: '0.85rem', margin: 0 }}>{error}</p>
          )}

          <StripedMotionButton
            type="submit"
            className="btn-primary"
            style={{ padding: '13px', marginTop: '0.4rem', width: '100%' }}
            isLoading={submitting}
            loadingText="Salvando..."
          >
            Salvar e continuar
          </StripedMotionButton>

          <button
            type="button"
            onClick={customerLogout}
            style={{
              marginTop: '4px',
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <LogOut size={14} /> Sair desta conta
          </button>
        </form>
      </div>
    </div>
  );
};

export default CompleteProfileGate;
