import React, { useState } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';
import { platformFetch, slugify, validateStrongPassword } from './platformAuth';

export default function CreateTenantModal({ open, onClose, onCreated }) {
  const [shopName, setShopName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [managerName, setManagerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [createDefaultServices, setCreateDefaultServices] = useState(true);
  const [createDefaultHours, setCreateDefaultHours] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const onShopNameChange = (v) => {
    setShopName(v);
    if (!slugTouched) setSlug(slugify(v));
  };

  const reset = () => {
    setShopName('');
    setSlug('');
    setSlugTouched(false);
    setManagerName('');
    setEmail('');
    setPassword('');
    setPasswordConfirm('');
    setShowPassword(false);
    setCreateDefaultServices(true);
    setCreateDefaultHours(true);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const pwdErr = validateStrongPassword(password);
    if (pwdErr) {
      setError(pwdErr);
      return;
    }
    if (password !== passwordConfirm) {
      setError('As senhas não coincidem.');
      return;
    }
    setLoading(true);
    try {
      const result = await platformFetch('/tenants', {
        method: 'POST',
        body: JSON.stringify({
          shopName,
          slug: slug || slugify(shopName),
          managerName,
          email,
          password,
          createDefaultServices,
          createDefaultHours,
        }),
      });
      reset();
      onCreated(result);
      onClose();
    } catch (err) {
      setError(err.message || 'Erro ao criar barbearia');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={handleClose}>
      <div
        className="modal-glass-panel fade-in"
        style={{ width: '95%', maxWidth: '440px', padding: '1.75rem' }}
        role="dialog"
        aria-labelledby="create-tenant-title"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="booking-reserve-form__title-row">
          <h2 id="create-tenant-title" className="booking-reserve-form__title">
            Nova barbearia
          </h2>
          <button type="button" className="booking-reserve-form__close" onClick={handleClose} aria-label="Fechar">
            <X size={20} />
          </button>
        </div>

        {error && <p className="platform-form-error" style={{ marginBottom: '0.75rem' }}>{error}</p>}

        <form onSubmit={handleSubmit} className="booking-reserve-form">
          <input
            type="text"
            className="booking-reserve-form__field"
            placeholder="Nome da barbearia *"
            required
            value={shopName}
            onChange={(ev) => onShopNameChange(ev.target.value)}
            autoComplete="organization"
          />
          <input
            type="text"
            className="booking-reserve-form__field"
            placeholder="URL (slug) *"
            required
            value={slug}
            onChange={(ev) => {
              setSlugTouched(true);
              setSlug(slugify(ev.target.value));
            }}
          />
          <p className="booking-reserve-form__hint">/{slug || 'sua-url'}</p>
          <input
            type="text"
            className="booking-reserve-form__field"
            placeholder="Nome do gestor *"
            required
            value={managerName}
            onChange={(ev) => setManagerName(ev.target.value)}
            autoComplete="name"
          />
          <input
            type="email"
            className="booking-reserve-form__field"
            placeholder="E-mail do gestor *"
            required
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            autoComplete="email"
          />
          <div className="platform-password-field">
            <input
              type={showPassword ? 'text' : 'password'}
              className="booking-reserve-form__field"
              placeholder="Senha inicial *"
              required
              minLength={8}
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              autoComplete="new-password"
            />
            <button
              type="button"
              className="platform-password-toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <input
            type={showPassword ? 'text' : 'password'}
            className="booking-reserve-form__field"
            placeholder="Confirmar senha *"
            required
            minLength={8}
            value={passwordConfirm}
            onChange={(ev) => setPasswordConfirm(ev.target.value)}
            autoComplete="new-password"
          />
          <p className="booking-reserve-form__hint">Mín. 8 caracteres, maiúscula, minúscula e número.</p>

          <label className="platform-checkbox-label">
            <input
              type="checkbox"
              checked={createDefaultServices}
              onChange={(e) => setCreateDefaultServices(e.target.checked)}
            />
            Criar serviços padrão (Corte, Barba)
          </label>
          <label className="platform-checkbox-label">
            <input
              type="checkbox"
              checked={createDefaultHours}
              onChange={(e) => setCreateDefaultHours(e.target.checked)}
            />
            Criar horário padrão (seg–sáb)
          </label>

          <div className="booking-reserve-form__row" style={{ marginTop: '0.25rem' }}>
            <button type="button" className="dash-action-btn secondary" style={{ flex: 1 }} onClick={handleClose}>
              Cancelar
            </button>
            <button type="submit" className="dash-action-btn primary booking-reserve-form__submit" style={{ flex: 1, marginTop: 0 }} disabled={loading}>
              {loading ? 'Criando…' : 'Criar barbearia'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
