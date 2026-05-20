import React, { useState } from 'react';
import { X } from 'lucide-react';
import { platformFetch, slugify } from './platformAuth';

export default function CreateTenantModal({ open, onClose, onCreated }) {
  const [shopName, setShopName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [managerName, setManagerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await platformFetch('/platform/tenants', {
        method: 'POST',
        body: JSON.stringify({
          shopName,
          slug: slug || slugify(shopName),
          managerName,
          email,
          password,
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
          <p className="booking-reserve-form__hint">/{slug || 'sua-url'}/cliente</p>
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
          <input
            type="password"
            className="booking-reserve-form__field"
            placeholder="Senha inicial *"
            required
            minLength={4}
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            autoComplete="new-password"
          />
          <div className="booking-reserve-form__row" style={{ marginTop: '0.25rem' }}>
            <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={handleClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary booking-reserve-form__submit" style={{ flex: 1, marginTop: 0 }} disabled={loading}>
              {loading ? 'Criando…' : 'Criar barbearia'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
