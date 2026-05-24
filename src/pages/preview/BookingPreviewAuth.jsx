import React from 'react';

export function CloseIcon() {
  return (
    <svg
      className="bp-auth-card__close-icon"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M18 6L6 18M6 6l12 12"
        stroke="#374151"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function GoogleIcon() {
  return (
    <svg className="bp-btn-google__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C43.68 37.08 46.98 31.38 46.98 24.55z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export function AuthLoginCard({
  authMode,
  setAuthMode,
  authData,
  setAuthData,
  authError,
  authInfo,
  googleBusy,
  forgotBusy,
  openForgotPassword,
  onAuthSubmit,
  onGoogleLogin,
  onClose,
  title,
  subtitle,
}) {
  const isForgot = authMode === 'forgot';
  const isRegister = authMode === 'register';

  const resolvedTitle = title ?? (
    isForgot ? 'Esqueci minha senha' : isRegister ? 'Criar conta' : 'Entre para confirmar'
  );
  const resolvedSubtitle = subtitle ?? (
    isForgot
      ? 'Informe o e-mail da sua conta. Enviaremos um link para criar uma nova senha.'
      : isRegister
        ? 'Preencha seus dados para finalizar o cadastro.'
        : 'Faça login ou crie sua conta para finalizar o agendamento.'
  );

  return (
    <div className="bp-auth-card" role="dialog" aria-labelledby="bp-auth-card-title" aria-modal="true">
      <button type="button" className="bp-auth-card__close" onClick={onClose} aria-label="Fechar">
        <CloseIcon />
      </button>
      <p id="bp-auth-card-title" className="bp-auth-card__title">
        {resolvedTitle}
      </p>
      <p className="bp-auth-card__subtitle">{resolvedSubtitle}</p>

      {authInfo ? (
        <p className="bp-auth-card__info" role="status">
          {authInfo}
        </p>
      ) : null}

      <form className="bp-auth-card__form" onSubmit={onAuthSubmit}>
        {isRegister && (
          <>
            <input
              className="bp-input"
              type="text"
              placeholder="Nome completo"
              required
              value={authData.name}
              onChange={(e) => setAuthData({ ...authData, name: e.target.value })}
            />
            <input
              className="bp-input"
              type="tel"
              placeholder="WhatsApp"
              required
              value={authData.phone}
              onChange={(e) => setAuthData({ ...authData, phone: e.target.value })}
            />
          </>
        )}
        <input
          className="bp-input"
          type="email"
          placeholder="E-mail"
          required
          value={authData.email}
          onChange={(e) => setAuthData({ ...authData, email: e.target.value })}
          autoComplete="email"
        />
        {!isForgot && (
          <input
            className="bp-input"
            type="password"
            placeholder="Senha"
            required
            value={authData.password}
            onChange={(e) => setAuthData({ ...authData, password: e.target.value })}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
          />
        )}
        {authError && <p className="bp-error bp-error--left">{authError}</p>}
        <button
          type="submit"
          className="bp-btn-continuar bp-btn-continuar--compact"
          disabled={forgotBusy}
        >
          {isForgot
            ? (forgotBusy ? 'Enviando…' : 'Enviar link')
            : (authMode === 'login' ? 'Entrar' : 'Cadastrar')}
        </button>
      </form>

      {authMode === 'login' && (
        <>
          <button
            type="button"
            className="bp-auth-card__forgot-link"
            onClick={openForgotPassword}
          >
            Esqueci minha senha
          </button>
          <button type="button" className="bp-btn-google" onClick={onGoogleLogin} disabled={googleBusy}>
            <GoogleIcon />
            <span>{googleBusy ? 'Conectando...' : 'Entrar com Google'}</span>
          </button>
        </>
      )}

      {isForgot ? (
        <button
          type="button"
          className="bp-link-btn"
          onClick={() => setAuthMode('login')}
        >
          Voltar ao login
        </button>
      ) : (
        <button
          type="button"
          className="bp-link-btn"
          onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
        >
          {authMode === 'login' ? 'Criar conta' : 'Já tenho conta'}
        </button>
      )}
    </div>
  );
}
