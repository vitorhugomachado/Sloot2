const fs = require('fs/promises');
const path = require('path');
const {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { UUID_RE } = require('./bookingPage');

const LOCAL_ROOT = path.resolve(__dirname, '../../.data/booking-media');

function getDriver() {
  const configured = String(process.env.BOOKING_MEDIA_DRIVER || '').trim().toLowerCase();
  if (configured) return configured;
  return process.env.NODE_ENV === 'production' ? 's3' : 'local';
}

function s3Config() {
  return {
    bucket: process.env.BUCKET?.trim(),
    endpoint: process.env.ENDPOINT?.trim(),
    region: process.env.REGION?.trim() || 'auto',
    accessKeyId: process.env.ACCESS_KEY_ID?.trim(),
    secretAccessKey: process.env.SECRET_ACCESS_KEY?.trim(),
  };
}

function isBookingMediaStorageConfigured() {
  if (getDriver() === 'local') return true;
  const config = s3Config();
  return Boolean(config.bucket && config.endpoint && config.accessKeyId && config.secretAccessKey);
}

let s3Client;
function getS3Client() {
  if (s3Client) return s3Client;
  const config = s3Config();
  if (!isBookingMediaStorageConfigured()) throw new Error('Railway Storage Bucket não configurado.');
  s3Client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return s3Client;
}

function assetKey(tenantId, assetId) {
  const id = String(assetId || '').toLowerCase();
  if (!Number.isInteger(Number(tenantId)) || !UUID_RE.test(id)) throw new Error('Identificador de mídia inválido.');
  return `tenants/${Number(tenantId)}/booking-page/${id}.webp`;
}

function localPathFor(tenantId, assetId) {
  return path.join(LOCAL_ROOT, String(Number(tenantId)), `${String(assetId).toLowerCase()}.webp`);
}

async function putBookingMedia({ tenantId, assetId, body }) {
  if (!isBookingMediaStorageConfigured()) throw new Error('Armazenamento de imagens indisponível.');
  if (getDriver() === 'local') {
    const filePath = localPathFor(tenantId, assetId);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, body);
    return;
  }
  const config = s3Config();
  await getS3Client().send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: assetKey(tenantId, assetId),
    Body: body,
    ContentType: 'image/webp',
    ContentDisposition: 'inline',
    CacheControl: 'public, max-age=31536000, immutable',
  }));
}

async function deleteBookingMedia(tenantId, assetId) {
  if (!isBookingMediaStorageConfigured()) throw new Error('Armazenamento de imagens indisponível.');
  if (getDriver() === 'local') {
    try {
      await fs.unlink(localPathFor(tenantId, assetId));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    return;
  }
  const config = s3Config();
  await getS3Client().send(new DeleteObjectCommand({
    Bucket: config.bucket,
    Key: assetKey(tenantId, assetId),
  }));
}

async function bookingMediaExists(tenantId, assetId) {
  if (!isBookingMediaStorageConfigured()) return false;
  if (getDriver() === 'local') {
    try {
      await fs.access(localPathFor(tenantId, assetId));
      return true;
    } catch {
      return false;
    }
  }
  try {
    const config = s3Config();
    await getS3Client().send(new HeadObjectCommand({
      Bucket: config.bucket,
      Key: assetKey(tenantId, assetId),
    }));
    return true;
  } catch (error) {
    if (error?.$metadata?.httpStatusCode === 404 || error?.name === 'NotFound') return false;
    throw error;
  }
}

async function readLocalBookingMedia(tenantId, assetId) {
  if (getDriver() !== 'local') return null;
  return fs.readFile(localPathFor(tenantId, assetId));
}

async function getBookingMediaRedirectUrl(tenantId, assetId) {
  if (getDriver() === 'local') return null;
  if (!isBookingMediaStorageConfigured()) throw new Error('Armazenamento de imagens indisponível.');
  const config = s3Config();
  return getSignedUrl(
    getS3Client(),
    new GetObjectCommand({ Bucket: config.bucket, Key: assetKey(tenantId, assetId) }),
    { expiresIn: 3600 },
  );
}

async function listBookingMediaObjects() {
  const objects = [];
  if (!isBookingMediaStorageConfigured()) return objects;
  if (getDriver() === 'local') {
    let tenantDirs = [];
    try {
      tenantDirs = await fs.readdir(LOCAL_ROOT, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') return objects;
      throw error;
    }
    for (const tenantDir of tenantDirs) {
      if (!tenantDir.isDirectory() || !/^\d+$/.test(tenantDir.name)) continue;
      const files = await fs.readdir(path.join(LOCAL_ROOT, tenantDir.name), { withFileTypes: true });
      for (const file of files) {
        const match = file.isFile() && file.name.match(/^([0-9a-f-]{36})\.webp$/i);
        if (!match || !UUID_RE.test(match[1])) continue;
        const stat = await fs.stat(path.join(LOCAL_ROOT, tenantDir.name, file.name));
        objects.push({ tenantId: Number(tenantDir.name), assetId: match[1].toLowerCase(), lastModified: stat.mtime });
      }
    }
    return objects;
  }

  const config = s3Config();
  let continuationToken;
  do {
    const page = await getS3Client().send(new ListObjectsV2Command({
      Bucket: config.bucket,
      Prefix: 'tenants/',
      ContinuationToken: continuationToken,
    }));
    for (const item of page.Contents || []) {
      const match = String(item.Key || '').match(/^tenants\/(\d+)\/booking-page\/([0-9a-f-]{36})\.webp$/i);
      if (!match || !UUID_RE.test(match[2])) continue;
      objects.push({ tenantId: Number(match[1]), assetId: match[2].toLowerCase(), lastModified: item.LastModified });
    }
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);
  return objects;
}

module.exports = {
  assetKey,
  bookingMediaExists,
  deleteBookingMedia,
  getBookingMediaRedirectUrl,
  getDriver,
  isBookingMediaStorageConfigured,
  listBookingMediaObjects,
  putBookingMedia,
  readLocalBookingMedia,
};
