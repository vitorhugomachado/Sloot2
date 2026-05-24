import { API_URL } from '../config/apiUrl';
import { getPasswordResetRedirectUrl } from '../lib/supabase';

const GENERIC_SUCCESS =
  'Se existir uma conta com este e-mail, você receberá um link para redefinir a senha.';

/**
 * Pede recuperação de senha (API cria utilizador no Supabase Auth e envia o e-mail).
 */
export async function requestCustomerPasswordReset(email, tenantSlug) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) {
    throw new Error('Informe o e-mail.');
  }

  const redirectTo = getPasswordResetRedirectUrl(tenantSlug);

  const res = await fetch(`${API_URL}/customer-auth/forgot-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Slug': tenantSlug,
    },
    body: JSON.stringify({ email: normalized, redirectTo }),
  });

  let body = {};
  try {
    body = await res.json();
  } catch {
    /* resposta não-JSON */
  }

  if (!res.ok) {
    throw new Error(body.message || 'Não foi possível enviar o e-mail de recuperação.');
  }

  return body.message || GENERIC_SUCCESS;
}
