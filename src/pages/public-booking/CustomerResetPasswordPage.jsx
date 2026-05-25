import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_URL } from '../../config/apiUrl';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import { tenantBookingPath } from '../../constants/tenantRoutes';
import '../preview/booking-preview-v2.css';

export default function CustomerResetPasswordPage() {
  const { slug, tenantHeaders } = useTenant();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setError('Recuperação de senha não configurada (variáveis Supabase no .env).');
      return undefined;
    }

    const supabase = getSupabase();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.');
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      setError('Supabase não configurado.');
      return;
    }

    setBusy(true);
    try {
      const { data: sessionData, error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        const { data: refreshed } = await supabase.auth.getSession();
        if (!refreshed.session?.access_token) {
          throw new Error('Sessão inválida. Abra o link do e-mail novamente.');
        }
      }

      const token = accessToken || (await supabase.auth.getSession()).data.session?.access_token;
      const syncRes = await fetch(`${API_URL}/customer-auth/sync-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...tenantHeaders,
        },
        body: JSON.stringify({ password }),
      });

      const syncBody = await syncRes.json().catch(() => ({}));
      if (!syncRes.ok) {
        throw new Error(syncBody.message || 'Não foi possível guardar a nova senha.');
      }

      await supabase.auth.signOut();
      setSuccess('Senha atualizada! Você já pode entrar com a nova senha.');
      window.setTimeout(() => {
        navigate(tenantBookingPath(slug), { replace: true, state: { portalLogin: true } });
      }, 2200);
    } catch (err) {
      setError(err.message || 'Não foi possível redefinir a senha.');
    } finally {
      setBusy(false);
    }
  };

  const bookingUrl = tenantBookingPath(slug);

  return (
    <div className="bp-reset-page">
      <div className="bp-auth-card bp-auth-card--page">
        <p className="bp-auth-card__title">Nova senha</p>
        <p className="bp-auth-card__subtitle">
          {ready
            ? 'Escolha uma nova senha para a sua conta.'
            : 'A validar o link do e-mail…'}
        </p>

        {!ready ? (
          <p className="bp-auth-card__info">Aguarde ou abra novamente o link recebido por e-mail.</p>
        ) : (
          <form className="bp-auth-card__form" onSubmit={handleSubmit}>
            <input
              className="bp-input"
              type="password"
              placeholder="Nova senha"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <input
              className="bp-input"
              type="password"
              placeholder="Confirmar senha"
              required
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
            {error && <p className="bp-error bp-error--left">{error}</p>}
            {success && <p className="bp-auth-card__info" role="status">{success}</p>}
            <button
              type="submit"
              className="bp-btn-continuar bp-btn-continuar--compact"
              disabled={busy}
            >
              {busy ? 'Salvando…' : 'Salvar nova senha'}
            </button>
          </form>
        )}

        <Link to={bookingUrl} className="bp-link-btn bp-reset-page__back">
          Voltar ao agendamento
        </Link>
      </div>
    </div>
  );
}
