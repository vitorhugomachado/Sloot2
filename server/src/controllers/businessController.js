const prisma = require('../lib/prisma.js');
const { invalidatePublicCache } = require('../middlewares/publicCache');
const { tenantIdFromReq, publicTenantShape } = require('../lib/tenantHelpers');

function nullableString(v) {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function buildBusinessUpdatePayload(body) {
  const b = body && typeof body === 'object' ? body : {};
  const data = {};

  if (b.name !== undefined) data.name = String(b.name ?? '').trim() || undefined;
  if (b.phone !== undefined) data.phone = String(b.phone ?? '').trim();
  if (b.email !== undefined) data.email = String(b.email ?? '').trim();
  if (b.address !== undefined) data.address = String(b.address ?? '').trim();

  if (b.logo_url !== undefined) data.logo_url = nullableString(b.logo_url);
  if (b.instagram_url !== undefined) data.instagram_url = nullableString(b.instagram_url);
  if (b.facebook_url !== undefined) data.facebook_url = nullableString(b.facebook_url);
  if (b.whatsapp_url !== undefined) data.whatsapp_url = nullableString(b.whatsapp_url);

  if (b.show_instagram !== undefined) data.show_instagram = Boolean(b.show_instagram);
  if (b.show_facebook !== undefined) data.show_facebook = Boolean(b.show_facebook);
  if (b.show_whatsapp !== undefined) data.show_whatsapp = Boolean(b.show_whatsapp);

  Object.keys(data).forEach((k) => {
    if (data[k] === undefined) delete data[k];
  });

  return data;
}

/** v2 — dados em Tenant (não usa tabela BusinessInfo) */
const getBusinessInfo = async (req, res, next) => {
  try {
    if (!req.tenant) {
      return res.status(400).json({ message: 'Barbearia não resolvida.' });
    }
    res.json(publicTenantShape(req.tenant));
  } catch (err) {
    next(err);
  }
};

const updateBusinessInfo = async (req, res, next) => {
  try {
    if (req.user?.role !== 'Gerente') {
      return res.status(403).json({ message: 'Apenas gestão pode alterar os dados do negócio.' });
    }

    const data = buildBusinessUpdatePayload(req.body);
    const tenant = await prisma.tenant.update({
      where: { id: tenantIdFromReq(req) },
      data,
    });

    invalidatePublicCache(req.tenantSlug);
    res.json(publicTenantShape(tenant));
  } catch (err) {
    next(err);
  }
};

module.exports = { getBusinessInfo, updateBusinessInfo };
