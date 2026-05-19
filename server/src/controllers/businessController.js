const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function nullableString(v) {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s === '' ? null : s;
}

/** Monta objeto só com campos do modelo; booleans coerced; strings opcionais → null se vazio. */
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

const getBusinessInfo = async (req, res, next) => {
  try {
    const info = await prisma.businessInfo.findUnique({ where: { id: 1 } });
    res.json(info);
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

    const existing = await prisma.businessInfo.findUnique({ where: { id: 1 } });

    let info;
    if (existing) {
      info = await prisma.businessInfo.update({
        where: { id: 1 },
        data,
      });
    } else {
      info = await prisma.businessInfo.create({
        data: {
          id: 1,
          name: data.name || 'Meu negócio',
          phone: data.phone ?? '',
          email: data.email ?? '',
          address: data.address ?? '',
          logo_url: data.logo_url ?? null,
          instagram_url: data.instagram_url ?? null,
          facebook_url: data.facebook_url ?? null,
          whatsapp_url: data.whatsapp_url ?? null,
          show_instagram: data.show_instagram ?? false,
          show_facebook: data.show_facebook ?? false,
          show_whatsapp: data.show_whatsapp ?? false,
        },
      });
    }

    res.json(info);
  } catch (err) {
    next(err);
  }
};

module.exports = { getBusinessInfo, updateBusinessInfo };
