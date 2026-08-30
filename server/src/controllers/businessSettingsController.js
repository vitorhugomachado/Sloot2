const crypto = require('crypto');
const sharp = require('sharp');
const prisma = require('../lib/prisma.js');
const { invalidatePublicCache } = require('../middlewares/publicCache');
const { buildBusinessUpdatePayload } = require('./businessController');
const { normalizeSlug, publicTenantShape, tenantIdFromReq } = require('../lib/tenantHelpers');
const {
  BookingSettingsValidationError,
  UUID_RE,
  bookingMediaUrl,
  bookingPageAssetIds,
  normalizeBookingPageConfig,
  normalizeWeeklyHours,
  serializeWeeklyHours,
  weeklyHoursToPrismaRows,
} = require('../lib/bookingPage');
const {
  bookingMediaExists,
  deleteBookingMedia,
  getBookingMediaRedirectUrl,
  getDriver,
  isBookingMediaStorageConfigured,
  putBookingMedia,
  readLocalBookingMedia,
} = require('../lib/bookingMediaStorage');

function requireManager(req, res, next) {
  if (req.user?.role !== 'Gerente') {
    return res.status(403).json({ message: 'Apenas o gerente pode publicar a página de agendamento.' });
  }
  next();
}

function validationResponse(res, error) {
  return res.status(400).json({
    message: error.message,
    issues: Array.isArray(error.issues) ? error.issues : [],
  });
}

async function loadBusinessSettings(tenantId) {
  const [tenant, hours] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId } }),
    prisma.workingHours.findMany({ where: { tenantId }, orderBy: { dia_semana: 'asc' } }),
  ]);
  return { tenant, hours };
}

function businessSettingsResponse(tenant, hours) {
  const bookingPageConfig = normalizeBookingPageConfig(tenant.bookingPageConfig, { throwOnError: false });
  return {
    revision: tenant.updatedAt.toISOString(),
    profile: publicTenantShape(tenant),
    bookingPageConfig,
    weeklyHours: serializeWeeklyHours(hours),
    media: {
      coverUrl: bookingMediaUrl(tenant.slug, bookingPageConfig.coverAssetId),
      galleryUrls: bookingPageConfig.galleryAssetIds.map((id) => bookingMediaUrl(tenant.slug, id)),
    },
    storageConfigured: isBookingMediaStorageConfigured(),
  };
}

async function getBusinessSettings(req, res, next) {
  try {
    const data = await loadBusinessSettings(tenantIdFromReq(req));
    if (!data.tenant) return res.status(404).json({ message: 'Barbearia não encontrada.' });
    res.set('Cache-Control', 'no-store');
    return res.json(businessSettingsResponse(data.tenant, data.hours));
  } catch (error) {
    next(error);
  }
}

async function assertNewAssetsExist(tenant, currentConfig, nextConfig) {
  const currentIds = new Set(bookingPageAssetIds(currentConfig));
  const newIds = bookingPageAssetIds(nextConfig).filter((id) => !currentIds.has(id));
  if (!newIds.length) return;
  if (!isBookingMediaStorageConfigured()) {
    const error = new Error('Armazenamento de imagens indisponível. Remova as imagens novas e tente novamente.');
    error.statusCode = 503;
    throw error;
  }
  const checks = await Promise.all(newIds.map((id) => bookingMediaExists(tenant.id, id)));
  const missing = newIds.filter((_, index) => !checks[index]);
  if (missing.length) {
    throw new BookingSettingsValidationError('Uma ou mais imagens não pertencem a esta barbearia.', missing);
  }
}

async function updateBusinessSettings(req, res, next) {
  try {
    const tenantId = tenantIdFromReq(req);
    const current = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!current) return res.status(404).json({ message: 'Barbearia não encontrada.' });

    const revision = new Date(String(req.body?.revision || ''));
    if (Number.isNaN(revision.getTime())) {
      return validationResponse(res, new BookingSettingsValidationError('A revisão da configuração é obrigatória.'));
    }
    const profile = req.body?.profile && typeof req.body.profile === 'object' ? req.body.profile : {};
    if (profile.name !== undefined && !String(profile.name || '').trim()) {
      return validationResponse(res, new BookingSettingsValidationError('O nome do negócio é obrigatório.'));
    }
    const profileData = buildBusinessUpdatePayload(profile);
    const bookingPageConfig = normalizeBookingPageConfig(req.body?.bookingPageConfig);
    const weeklyHours = normalizeWeeklyHours(req.body?.weeklyHours);
    await assertNewAssetsExist(current, current.bookingPageConfig, bookingPageConfig);

    const updatedAt = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.tenant.updateMany({
        where: { id: tenantId, updatedAt: revision },
        data: { ...profileData, bookingPageConfig, updatedAt },
      });
      if (result.count !== 1) {
        const conflict = new Error('A configuração foi alterada em outra sessão. Recarregue antes de salvar.');
        conflict.statusCode = 409;
        throw conflict;
      }
      await tx.workingHours.deleteMany({ where: { tenantId } });
      const rows = weeklyHoursToPrismaRows(tenantId, weeklyHours);
      if (rows.length) await tx.workingHours.createMany({ data: rows });
      return tx.tenant.findUnique({ where: { id: tenantId } });
    });

    invalidatePublicCache(req.tenantSlug);
    const hours = await prisma.workingHours.findMany({ where: { tenantId }, orderBy: { dia_semana: 'asc' } });
    res.set('Cache-Control', 'no-store');
    return res.json(businessSettingsResponse(updated, hours));
  } catch (error) {
    if (error instanceof BookingSettingsValidationError) return validationResponse(res, error);
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    next(error);
  }
}

function isJpeg(buffer) {
  return Buffer.isBuffer(buffer)
    && buffer.length >= 4
    && buffer[0] === 0xff
    && buffer[1] === 0xd8
    && buffer[2] === 0xff;
}

async function uploadBookingPageMedia(req, res, next) {
  try {
    if (!isBookingMediaStorageConfigured()) {
      return res.status(503).json({ message: 'Armazenamento de imagens não configurado.' });
    }
    const purpose = typeof req.query.purpose === 'string' ? req.query.purpose : '';
    if (!['cover', 'gallery'].includes(purpose)) {
      return res.status(400).json({ message: 'Informe purpose=cover ou purpose=gallery.' });
    }
    if (!isJpeg(req.body)) {
      return res.status(415).json({ message: 'Envie uma imagem JPEG válida.' });
    }

    let output;
    try {
      output = await sharp(req.body, { limitInputPixels: 36_000_000 })
        .rotate()
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
    } catch {
      return res.status(415).json({ message: 'A imagem não pôde ser validada.' });
    }

    const assetId = crypto.randomUUID();
    await putBookingMedia({ tenantId: tenantIdFromReq(req), assetId, body: output });
    res.set('Cache-Control', 'no-store');
    return res.status(201).json({
      assetId,
      previewUrl: bookingMediaUrl(req.tenantSlug, assetId),
    });
  } catch (error) {
    next(error);
  }
}

async function removeBookingPageMedia(req, res, next) {
  try {
    const assetId = String(req.params.assetId || '').trim().toLowerCase();
    if (!UUID_RE.test(assetId)) return res.status(400).json({ message: 'Identificador de mídia inválido.' });
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantIdFromReq(req) } });
    if (bookingPageAssetIds(tenant?.bookingPageConfig).includes(assetId)) {
      return res.status(409).json({ code: 'ASSET_IN_USE', message: 'Remova a imagem da página antes de excluí-la.' });
    }
    await deleteBookingMedia(tenant.id, assetId);
    return res.status(204).end();
  } catch (error) {
    next(error);
  }
}

async function getPublicBookingMedia(req, res, next) {
  try {
    const slug = normalizeSlug(req.params.slug);
    const assetId = String(req.params.assetId || '').trim().toLowerCase();
    if (!slug || !UUID_RE.test(assetId)) return res.status(404).end();
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (!tenant || tenant.status === 'suspended') return res.status(404).end();
    if (!(await bookingMediaExists(tenant.id, assetId))) return res.status(404).end();

    if (getDriver() === 'local') {
      const body = await readLocalBookingMedia(tenant.id, assetId);
      res.set('Content-Type', 'image/webp');
      res.set('Cache-Control', 'public, max-age=3600');
      return res.send(body);
    }
    const redirectUrl = await getBookingMediaRedirectUrl(tenant.id, assetId);
    res.set('Cache-Control', 'private, max-age=300');
    return res.redirect(302, redirectUrl);
  } catch (error) {
    if (error.code === 'ENOENT') return res.status(404).end();
    next(error);
  }
}

module.exports = {
  getBusinessSettings,
  getPublicBookingMedia,
  removeBookingPageMedia,
  requireManager,
  updateBusinessSettings,
  uploadBookingPageMedia,
};
