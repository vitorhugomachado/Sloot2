import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * Card de login staff — layout idêntico ao protótipo canvas (mobile + web).
 */
export default function StaffLoginFormCard({
  onSubmit,
  error,
  isSubmitting = false,
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onSubmit?.(email, password);
  };

  return (
    <div className="staff-login-card">
      {error ? (
        <div className="staff-login-card__alert" role="alert">
          <p className="staff-login-card__alert-title">Não foi possível entrar</p>
          <p className="staff-login-card__alert-body">{error}</p>
        </div>
      ) : null}

      <form className="staff-login-card__form" onSubmit={handleSubmit}>
        <div className="staff-login-field">
          <span className="staff-login-field__label" id="staff-login-email-label">
            E-mail
          </span>
          <div className="staff-login-field__control">
            <input
              className="staff-login-field__input"
              type="email"
              placeholder="name@email.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              aria-labelledby="staff-login-email-label"
            />
          </div>
        </div>

        <div className="staff-login-field">
          <span className="staff-login-field__label" id="staff-login-password-label">
            Senha
          </span>
          <div className="staff-login-field__control staff-login-field__control--password">
            <input
              className="staff-login-field__input"
              type={showPassword ? 'text' : 'password'}
              placeholder="Senha"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              aria-labelledby="staff-login-password-label"
            />
            <button
              type="button"
              className="staff-login-field__toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              aria-pressed={showPassword}
            >
              {showPassword ? (
                <EyeOff size={18} strokeWidth={1.75} aria-hidden />
              ) : (
                <Eye size={18} strokeWidth={1.75} aria-hidden />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          className="staff-login-card__submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
