const prisma = require('../lib/prisma.js');
const { OAuth2Client } = require('google-auth-library');
const { hashPassword, comparePassword, generateToken } = require('../utils/auth');
const { tenantIdFromReq } = require('../lib/tenantHelpers');
const { isSupabaseAuthConfigured } = require('../lib/supabaseAdmin');
const {
  ensureSupabaseAuthUser,
  syncSupabaseAuthPassword,
  getSupabaseUserFromAccessToken,
  sendPasswordRecoveryEmail,
} = require('../lib/supabaseCustomerAuth');

function buildPasswordResetRedirect(req, tenantSlug) {
  const fromBody = typeof req.body?.redirectTo === 'string' ? req.body.redirectTo.trim() : '';
  if (fromBody && /^https?:\/\//i.test(fromBody)) return fromBody;

  const origin = req.headers.origin || process.env.FRONTEND_URL || 'http://localhost:5173';
  const slug = String(tenantSlug || req.tenantSlug || '').trim().toLowerCase();
  return `${String(origin).replace(/\/$/, '')}/${slug}/cliente/redefinir-senha`;
}

const FORGOT_PASSWORD_GENERIC =
  'Se existir uma conta com este e-mail, você receberá um link para redefinir a senha.';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const DUPLICATE_EMAIL_MESSAGE =
  'Você já possui cadastro com este e-mail. Faça login para continuar.';

const normalizeCustomerEmail = (email) => {
  if (email == null || String(email).trim() === '') return null;
  return String(email).trim().toLowerCase();
};

const findCustomerByEmail = (tenantId, email) => {
  const normalized = normalizeCustomerEmail(email);
  if (!normalized) return Promise.resolve(null);
  return prisma.customer.findUnique({
    where: { tenantId_email: { tenantId, email: normalized } },
  });
};

const customerTokenPayload = (customer) => ({
  id: customer.id,
  role: 'customer',
  tenantId: customer.tenantId,
});

const register = async (req, res) => {
  const { name, email, password, phone } = req.body;
  const normalizedEmail = normalizeCustomerEmail(email);
  const tenantId = tenantIdFromReq(req);

  if (!normalizedEmail) {
    return res.status(400).json({ message: 'E-mail é obrigatório' });
  }

  try {
    const existingUser = await findCustomerByEmail(tenantId, normalizedEmail);
    if (existingUser) {
      return res.status(400).json({ message: DUPLICATE_EMAIL_MESSAGE });
    }

    const hashedPassword = await hashPassword(password);
    const customer = await prisma.customer.create({
      data: {
        tenantId,
        name,
        email: normalizedEmail,
        password: hashedPassword,
        phone,
      },
    });

    if (isSupabaseAuthConfigured()) {
      try {
        await syncSupabaseAuthPassword(normalizedEmail, password, {
          tenant_id: tenantId,
          customer_id: customer.id,
        });
      } catch (syncErr) {
        console.error('Supabase Auth sync on register:', syncErr);
      }
    }

    const token = generateToken(customerTokenPayload(customer));
    const { password: _, ...customerData } = customer;

    res.status(201).json({ token, user: customerData });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ message: DUPLICATE_EMAIL_MESSAGE });
    }
    console.error('Customer register error:', error);
    res.status(500).json({ message: 'Erro ao cadastrar cliente' });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = normalizeCustomerEmail(email);
  const tenantId = tenantIdFromReq(req);

  try {
    const customer = normalizedEmail
      ? await findCustomerByEmail(tenantId, normalizedEmail)
      : null;

    if (!customer) {
      return res.status(401).json({ message: 'E-mail ou senha incorretos' });
    }

    const isMatch = await comparePassword(password, customer.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'E-mail ou senha incorretos' });
    }

    const token = generateToken(customerTokenPayload(customer));
    const { password: _, ...customerData } = customer;

    res.json({ token, user: customerData });
  } catch (error) {
    console.error('Customer login error:', error);
    res.status(500).json({ message: 'Erro interno no servidor' });
  }
};

const googleLogin = async (req, res) => {
  const { credential } = req.body || {};
  const tenantId = tenantIdFromReq(req);

  if (!credential) {
    return res.status(400).json({ message: 'Credencial Google não enviada' });
  }

  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(500).json({ message: 'GOOGLE_CLIENT_ID não configurado no servidor' });
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = payload?.email?.toLowerCase();

    if (!email || !payload.email_verified) {
      return res.status(401).json({ message: 'Conta Google inválida ou não verificada' });
    }

    let customer = await findCustomerByEmail(tenantId, email);

    if (!customer) {
      const generatedPassword = await hashPassword(`google-${Date.now()}-${Math.random()}`);
      customer = await prisma.customer.create({
        data: {
          tenantId,
          name: payload?.name || 'Cliente',
          email,
          password: generatedPassword,
          phone: '',
        },
      });
    }

    const token = generateToken(customerTokenPayload(customer));
    const { password: _, ...customerData } = customer;
    return res.json({ token, user: customerData });
  } catch (error) {
    console.error('Customer Google login error:', error);
    return res.status(401).json({ message: 'Falha ao validar login Google' });
  }
};

const getMe = async (req, res) => {
  try {
    const customer = await prisma.customer.findFirst({
      where: { id: req.user.id, tenantId: req.user.tenantId },
    });
    if (!customer) return res.status(404).json({ message: 'Cliente não encontrado' });
    const { password: _, ...customerData } = customer;
    res.json(customerData);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar perfil' });
  }
};

const getMyAppointments = async (req, res) => {
  try {
    const appointments = await prisma.appointment.findMany({
      where: { tenantId: req.user.tenantId, customer_id: req.user.id },
      include: { Barber: { select: { name: true } } },
      orderBy: { date: 'desc' },
    });
    res.json(appointments);
  } catch (error) {
    console.error('getMyAppointments error:', error);
    res.status(500).json({ message: 'Erro ao buscar seu histórico' });
  }
};

const updateProfile = async (req, res) => {
  const { name, phone, email } = req.body;
  const normalizedEmail = email != null ? normalizeCustomerEmail(email) : undefined;
  const tenantId = req.user.tenantId;
  try {
    if (normalizedEmail) {
      const existing = await prisma.customer.findFirst({
        where: {
          tenantId,
          email: normalizedEmail,
          NOT: { id: req.user.id },
        },
      });
      if (existing) {
        return res.status(400).json({ message: DUPLICATE_EMAIL_MESSAGE });
      }
    }

    const updated = await prisma.customer.update({
      where: { id: req.user.id },
      data: {
        name,
        phone,
        ...(normalizedEmail != null ? { email: normalizedEmail } : {}),
      },
    });

    const { password: _, ...customerData } = updated;
    res.json(customerData);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ message: DUPLICATE_EMAIL_MESSAGE });
    }
    res.status(500).json({ message: 'Erro ao atualizar perfil' });
  }
};

const forgotPassword = async (req, res) => {
  const normalizedEmail = normalizeCustomerEmail(req.body?.email);
  const tenantId = tenantIdFromReq(req);

  if (!normalizedEmail) {
    return res.status(400).json({ message: 'Informe o e-mail.' });
  }

  if (!isSupabaseAuthConfigured()) {
    return res.status(503).json({
      message: 'Recuperação de senha não configurada no servidor (Supabase Auth).',
    });
  }

  try {
    const customer = await findCustomerByEmail(tenantId, normalizedEmail);
    if (!customer) {
      return res.json({ message: FORGOT_PASSWORD_GENERIC });
    }

    await ensureSupabaseAuthUser(normalizedEmail, {
      tenant_id: tenantId,
      customer_id: customer.id,
    });

    const redirectTo = buildPasswordResetRedirect(req, req.tenantSlug);
    await sendPasswordRecoveryEmail(normalizedEmail, redirectTo);

    return res.json({ message: FORGOT_PASSWORD_GENERIC });
  } catch (error) {
    console.error('Customer forgot password error:', error?.cause || error);
    const msg = String(error?.message || '');
    if (/redirect|url/i.test(msg) || error?.code === 'unexpected_failure') {
      return res.status(400).json({
        message:
          'URL de redirecionamento não autorizada no Supabase. Adicione em Authentication → URL Configuration o endereço da página redefinir-senha (ver docs/SUPABASE-RESET-SENHA.md).',
        details: msg,
      });
    }
    if (/invalid/i.test(msg) && /email/i.test(msg)) {
      return res.status(400).json({
        message: 'Este endereço de e-mail não é aceite pelo serviço de envio. Use o e-mail com que se registou na barbearia.',
        details: msg,
      });
    }
    return res.status(500).json({
      message: 'Não foi possível enviar o e-mail de recuperação. Tente novamente em alguns minutos.',
      details: process.env.NODE_ENV === 'production' ? undefined : msg,
    });
  }
};

const syncPassword = async (req, res) => {
  const authHeader = req.headers.authorization;
  const { password } = req.body || {};

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Sessão inválida. Abra o link do e-mail novamente.' });
  }

  if (!password || String(password).length < 6) {
    return res.status(400).json({ message: 'A senha deve ter pelo menos 6 caracteres.' });
  }

  if (!isSupabaseAuthConfigured()) {
    return res.status(503).json({ message: 'Supabase Auth não configurado no servidor.' });
  }

  try {
    const accessToken = authHeader.split(' ')[1];
    const authUser = await getSupabaseUserFromAccessToken(accessToken);
    if (!authUser?.email) {
      return res.status(401).json({ message: 'Sessão expirada. Solicite um novo link.' });
    }

    const tenantId = tenantIdFromReq(req);
    const customer = await findCustomerByEmail(tenantId, authUser.email);
    if (!customer) {
      return res.status(404).json({ message: 'Cliente não encontrado nesta barbearia.' });
    }

    const hashedPassword = await hashPassword(password);
    await prisma.customer.update({
      where: { id: customer.id },
      data: { password: hashedPassword },
    });

    await syncSupabaseAuthPassword(authUser.email, password, {
      tenant_id: tenantId,
      customer_id: customer.id,
    });

    return res.json({ message: 'Senha atualizada com sucesso.' });
  } catch (error) {
    console.error('Customer sync password error:', error);
    return res.status(500).json({ message: 'Não foi possível atualizar a senha.' });
  }
};

module.exports = {
  register,
  login,
  googleLogin,
  getMe,
  getMyAppointments,
  updateProfile,
  forgotPassword,
  syncPassword,
};
