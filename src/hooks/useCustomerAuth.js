import { useCallback, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useTenant } from '../context/TenantContext';
import { isValidPhone, normalizePhone, PHONE_ERROR } from '../utils/phone';
import { requestCustomerPasswordReset } from '../utils/customerPasswordReset';

export function useCustomerAuth({ onSuccess } = {}) {
  const { slug } = useTenant();
  const { customerLogin, customerRegister, customerGoogleLogin } = useApp();
  const [authMode, setAuthMode] = useState('login');
  const [authData, setAuthData] = useState({ email: '', password: '', name: '', phone: '' });
  const [authError, setAuthError] = useState('');
  const [authInfo, setAuthInfo] = useState('');
  const [googleBusy, setGoogleBusy] = useState(false);
  const [forgotBusy, setForgotBusy] = useState(false);

  const afterAuth = useCallback((user) => {
    onSuccess?.(user);
  }, [onSuccess]);

  const openForgotPassword = useCallback(() => {
    setAuthError('');
    setAuthInfo('');
    setAuthMode('forgot');
  }, []);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthInfo('');

    if (authMode === 'forgot') {
      setForgotBusy(true);
      try {
        const message = await requestCustomerPasswordReset(authData.email, slug);
        setAuthInfo(message);
      } catch (err) {
        setAuthError(err.message);
      } finally {
        setForgotBusy(false);
      }
      return;
    }

    try {
      let user;
      if (authMode === 'login') {
        user = await customerLogin(authData.email, authData.password);
      } else {
        if (!isValidPhone(authData.phone)) {
          setAuthError(PHONE_ERROR);
          return;
        }
        user = await customerRegister({
          email: authData.email.trim().toLowerCase(),
          password: authData.password,
          name: authData.name,
          phone: normalizePhone(authData.phone),
        });
      }
      afterAuth(user);
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleGoogleCustomerLogin = async () => {
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    setAuthError('');
    setAuthInfo('');

    if (!googleClientId) {
      setAuthError('Configuração ausente: defina VITE_GOOGLE_CLIENT_ID no frontend.');
      return;
    }

    if (!window.google?.accounts?.id) {
      setAuthError('Google ainda não carregou. Tente novamente em instantes.');
      return;
    }

    setGoogleBusy(true);
    try {
      const credential = await new Promise((resolve, reject) => {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: (response) => {
            if (response?.credential) resolve(response.credential);
            else reject(new Error('Falha ao obter credencial Google'));
          },
        });

        window.google.accounts.id.prompt((notification) => {
          const skipped = notification.isSkippedMoment && notification.isSkippedMoment();
          const notDisplayed = notification.isNotDisplayed && notification.isNotDisplayed();
          if ((skipped || notDisplayed) && !notification.getDismissedReason?.()) {
            reject(new Error('Não foi possível abrir a janela do Google'));
          }
        });
      });

      const user = await customerGoogleLogin(credential);
      afterAuth(user);
    } catch (err) {
      setAuthError(err.message || 'Erro no login com Google');
    } finally {
      setGoogleBusy(false);
    }
  };

  return {
    authMode,
    setAuthMode,
    authData,
    setAuthData,
    authError,
    authInfo,
    googleBusy,
    forgotBusy,
    openForgotPassword,
    handleAuthSubmit,
    handleGoogleCustomerLogin,
    onAuthSubmit: handleAuthSubmit,
    onGoogleLogin: handleGoogleCustomerLogin,
  };
}
