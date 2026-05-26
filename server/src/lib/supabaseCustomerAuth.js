const crypto = require('crypto');
const { getSupabaseAdmin } = require('./supabaseAdmin');

function isDuplicateAuthUserError(error) {
  const msg = String(error?.message || '').toLowerCase();
  return (
    error?.status === 422
    || msg.includes('already been registered')
    || msg.includes('already registered')
    || msg.includes('user already registered')
  );
}

async function findAuthUserByEmail(admin, email) {
  let page = 1;
  const perPage = 200;
  const normalized = String(email).trim().toLowerCase();

  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users || [];
    const match = users.find((u) => String(u.email || '').toLowerCase() === normalized);
    if (match) return match;
    if (users.length < perPage) break;
    page += 1;
  }
  return null;
}

/**
 * Garante utilizador no Supabase Auth com identidade de e-mail (necessário para resetPasswordForEmail).
 * Clientes que entraram só com Google no app muitas vezes não tinham utilizador Auth — ou só OAuth no Supabase.
 */
async function ensureSupabaseAuthUser(email, metadata = {}) {
  const admin = getSupabaseAdmin();
  if (!admin) return null;

  const normalized = String(email).trim().toLowerCase();
  const tempPassword = crypto.randomBytes(24).toString('base64url');

  let existing = await findAuthUserByEmail(admin, normalized);
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      email_confirm: true,
      password: tempPassword,
      user_metadata: { ...existing.user_metadata, ...metadata },
    });
    if (error) throw error;
    return existing;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: normalized,
    password: tempPassword,
    email_confirm: true,
    user_metadata: metadata,
  });

  if (error) {
    if (isDuplicateAuthUserError(error)) {
      existing = await findAuthUserByEmail(admin, normalized);
      if (existing) {
        const { error: updateErr } = await admin.auth.admin.updateUserById(existing.id, {
          email_confirm: true,
          password: tempPassword,
          user_metadata: { ...existing.user_metadata, ...metadata },
        });
        if (updateErr) throw updateErr;
        return existing;
      }
    }
    throw error;
  }

  return data.user;
}

/** Sincroniza senha no Auth ao cadastrar no Prisma. */
async function syncSupabaseAuthPassword(email, password, metadata = {}) {
  const admin = getSupabaseAdmin();
  if (!admin) return;

  const existing = await findAuthUserByEmail(admin, email);
  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, {
      password,
      user_metadata: { ...existing.user_metadata, ...metadata },
    });
    return;
  }

  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata,
  });

  if (error && !isDuplicateAuthUserError(error)) {
    throw error;
  }
}

async function getSupabaseUserFromAccessToken(accessToken) {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data, error } = await admin.auth.getUser(accessToken);
  if (error) throw error;
  return data?.user || null;
}

/** Dispara o e-mail de recuperação via Supabase Auth (mesmo projeto, SMTP do painel). */
async function sendPasswordRecoveryEmail(email, redirectTo) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    const err = new Error('Supabase Auth não configurado no servidor.');
    err.code = 'SUPABASE_NOT_CONFIGURED';
    throw err;
  }

  const { data, error } = await admin.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    const err = new Error(error.message || 'Falha ao solicitar e-mail de recuperação.');
    err.code = error.code || error.name;
    err.cause = error;
    throw err;
  }

  return data;
}

module.exports = {
  ensureSupabaseAuthUser,
  syncSupabaseAuthPassword,
  getSupabaseUserFromAccessToken,
  sendPasswordRecoveryEmail,
};
