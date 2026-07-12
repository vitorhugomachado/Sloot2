const prisma = require('../lib/prisma');
const { tenantIdFromReq } = require('../lib/tenantHelpers');
const { getVapidPublicKey, isWebPushConfigured } = require('../lib/webPush');

const STAFF_ROLES = new Set(['Gerente', 'Barbeiro']);

function requireStaff(req, res, next) {
  if (!req.user || req.user.role === 'customer') {
    return res.status(403).json({ message: 'Acesso restrito ao staff.' });
  }
  if (!STAFF_ROLES.has(req.user.role)) {
    return res.status(403).json({ message: 'Acesso restrito ao staff.' });
  }
  next();
}

const getVapidPublicKeyHandler = async (req, res) => {
  if (!isWebPushConfigured()) {
    return res.status(503).json({ message: 'Notificações push não configuradas no servidor.' });
  }

  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return res.status(503).json({ message: 'Chave pública VAPID indisponível.' });
  }

  res.json({ publicKey });
};

const subscribePush = async (req, res) => {
  try {
    if (!isWebPushConfigured()) {
      return res.status(503).json({ message: 'Notificações push não configuradas no servidor.' });
    }

    const { endpoint, keys } = req.body || {};
    const p256dh = keys?.p256dh;
    const auth = keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      return res.status(400).json({ message: 'Assinatura push inválida.' });
    }

    const tenantId = tenantIdFromReq(req);
    const barberId = Number(req.user.id);

    if (!Number.isFinite(barberId)) {
      return res.status(400).json({ message: 'Usuário staff inválido.' });
    }

    const barber = await prisma.barber.findFirst({
      where: { id: barberId, tenantId, deletedAt: null },
      select: { id: true },
    });

    if (!barber) {
      return res.status(403).json({ message: 'Profissional não encontrado nesta barbearia.' });
    }

    const userAgent = String(req.headers['user-agent'] || '').slice(0, 512) || null;

    await prisma.pushSubscription.upsert({
      where: { endpoint: String(endpoint) },
      create: {
        tenantId,
        barberId,
        endpoint: String(endpoint),
        p256dh: String(p256dh),
        auth: String(auth),
        userAgent,
      },
      update: {
        tenantId,
        barberId,
        p256dh: String(p256dh),
        auth: String(auth),
        userAgent,
      },
    });

    res.status(201).json({ ok: true });
  } catch (error) {
    console.error('subscribePush error:', error);
    res.status(500).json({ message: 'Erro ao salvar assinatura push.' });
  }
};

const unsubscribePush = async (req, res) => {
  try {
    const endpoint = req.body?.endpoint;
    if (!endpoint) {
      return res.status(400).json({ message: 'Endpoint da assinatura é obrigatório.' });
    }

    const tenantId = tenantIdFromReq(req);
    const barberId = Number(req.user.id);

    await prisma.pushSubscription.deleteMany({
      where: {
        endpoint: String(endpoint),
        tenantId,
        barberId,
      },
    });

    res.json({ ok: true });
  } catch (error) {
    console.error('unsubscribePush error:', error);
    res.status(500).json({ message: 'Erro ao remover assinatura push.' });
  }
};

module.exports = {
  requireStaff,
  getVapidPublicKeyHandler,
  subscribePush,
  unsubscribePush,
};
