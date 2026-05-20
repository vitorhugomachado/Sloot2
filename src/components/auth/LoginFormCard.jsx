import React, { useState } from 'react';
import { GoogleIcon } from '../../pages/preview/BookingPreviewAuth';
import { isValidPhone, PHONE_ERROR } from '../../utils/phone';

function FieldCircleIcon() {
  return (
    <span className="cl-field__circle" aria-hidden>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="#c4c4c4" strokeWidth="1.5" />
      </svg>
    </span>
  );
}

/**
 * Card de login unificado.
 * Modo cliente: passe authMode, authData, onAuthSubmit, etc.
 * Modo simples (staff/admin): passe onSubmit + title/subtitle; estado interno de email/senha.
 */
export default function LoginFormCard({
  title,
  subtitle,
  submitLabel,
  logoUrl,
  onSubmit,
  error: errorProp,
  isSubmitting = false,
  showGoogle = false,
  showRegister = false,
  showForgot = false,
  emailInputType = 'text',
  emailPlaceholder = 'E-mail ou telefone',
  showEmailIcon = true,
  authMode,
  setAuthMode,
  authData,
  setAuthData,
  authError,
  googleBusy,
  onAuthSubmit,
  onGoogleLogin,
}) {
  const isCustomerMode = authData != null && onAuthSubmit != null;
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const isRegister = isCustomerMode && authMode === 'register';
  const displayError = isCustomerMode ? authError : errorProp;

  const resolvedTitle = title ?? (isRegister ? 'Criar conta' : 'Entrar na conta');
  const resolvedSubtitle =
    subtitle ??
    (isRegister
      ? 'Preencha seus dados para acessar sua agenda.'
      : 'Informe seus dados para entrar na sua conta.');
  const resolvedSubmitLabel = submitLabel ?? (isRegister ? 'Cadastrar' : 'Entrar');

  const handleSimpleSubmit = async (e) => {
    e.preventDefault();
    await onSubmit?.(email, password);
  };

  const handleFormSubmit = isCustomerMode ? onAuthSubmit : handleSimpleSubmit;

  const emailValue = isCustomerMode ? authData.email : email;
  const passwordValue = isCustomerMode ? authData.password : password;
  const onEmailChange = isCustomerMode
    ? (e) => setAuthData({ ...authData, email: e.target.value })
    : (e) => setEmail(e.target.value);
  const onPasswordChange = isCustomerMode
    ? (e) => setAuthData({ ...authData, password: e.target.value })
    : (e) => setPassword(e.target.value);

  return (
    <div className="cl-login-card">
      <header className="cl-login-card__header">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt=""
            className="cl-login-card__logo"
          />
        ) : null}
        <h1 className="cl-login-card__title">{resolvedTitle}</h1>
        <p className="cl-login-card__subtitle">{resolvedSubtitle}</p>
      </header>

      <form className="cl-login-card__form" onSubmit={handleFormSubmit}>
        {isRegister && (
          <>
            <label className="cl-field">
              <input
                className="cl-field__input"
                type="text"
                placeholder="Nome completo"
                required
                value={authData.name}
                onChange={(e) => setAuthData({ ...authData, name: e.target.value })}
                autoComplete="name"
              />
            </label>
            <label className="cl-field">
              <input
                className="cl-field__input"
                type="tel"
                placeholder="WhatsApp"
                required
                value={authData.phone}
                onChange={(e) => setAuthData({ ...authData, phone: e.target.value })}
                autoComplete="tel"
              />
            </label>
          </>
        )}

        <label className="cl-field">
          <input
            className="cl-field__input"
            type={emailInputType}
            placeholder={emailPlaceholder}
            required
            value={emailValue}
            onChange={onEmailChange}
            autoComplete="username"
          />
          {showEmailIcon ? <FieldCircleIcon /> : null}
        </label>

        <label className="cl-field cl-field--password">
          <input
            className="cl-field__input"
            type={showPassword ? 'text' : 'password'}
            placeholder="Senha"
            required
            value={passwordValue}
            onChange={onPasswordChange}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
          />
          <button
            type="button"
            className="cl-field__toggle"
            onClick={() => setShowPassword((v) => !v)}
          >
            {showPassword ? 'Ocultar' : 'Mostrar'}
          </button>
        </label>

        {showForgot && !isRegister && (
          <button type="button" className="cl-login-card__forgot" disabled title="Em breve">
            Problemas para entrar?
          </button>
        )}

        {displayError && <p className="cl-login-card__error">{displayError}</p>}
        {isRegister && authData.phone && !isValidPhone(authData.phone) && (
          <p className="cl-login-card__error cl-login-card__error--hint">{PHONE_ERROR}</p>
        )}

        <button type="submit" className="cl-login-card__submit" disabled={isSubmitting}>
          {isSubmitting ? 'Entrando…' : resolvedSubmitLabel}
        </button>
      </form>

      {showGoogle && (
        <>
          <p className="cl-login-card__divider" aria-hidden>
            — Ou entre com —
          </p>
          <div className="cl-login-card__social">
            <button
              type="button"
              className="cl-social-btn"
              onClick={onGoogleLogin}
              disabled={googleBusy}
            >
              <GoogleIcon />
              <span>{googleBusy ? '...' : 'Google'}</span>
            </button>
          </div>
        </>
      )}

      {showRegister && isCustomerMode && (
        <p className="cl-login-card__footer">
          {isRegister ? (
            <>
              Já tem uma conta?{' '}
              <button type="button" className="cl-login-card__link" onClick={() => setAuthMode('login')}>
                Entrar
              </button>
            </>
          ) : (
            <>
              Não tem uma conta?{' '}
              <button type="button" className="cl-login-card__link" onClick={() => setAuthMode('register')}>
                Crie agora
              </button>
            </>
          )}
        </p>
      )}
    </div>
  );
}
