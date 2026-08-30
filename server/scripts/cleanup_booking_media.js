const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const prisma = require('../src/lib/prisma');
const { bookingPageAssetIds } = require('../src/lib/bookingPage');
const {
  deleteBookingMedia,
  isBookingMediaStorageConfigured,
  listBookingMediaObjects,
} = require('../src/lib/bookingMediaStorage');

const APPLY = process.argv.includes('--apply');
const RETENTION_MS = 24 * 60 * 60 * 1000;

async function main() {
  if (!isBookingMediaStorageConfigured()) throw new Error('Armazenamento de imagens não configurado.');
  const tenants = await prisma.tenant.findMany({ select: { id: true, bookingPageConfig: true } });
  const referenced = new Set();
  for (const tenant of tenants) {
    for (const assetId of bookingPageAssetIds(tenant.bookingPageConfig)) {
      referenced.add(`${tenant.id}:${assetId}`);
    }
  }

  const cutoff = Date.now() - RETENTION_MS;
  const objects = await listBookingMediaObjects();
  const orphans = objects.filter((item) => (
    !referenced.has(`${item.tenantId}:${item.assetId}`)
    && new Date(item.lastModified).getTime() < cutoff
  ));

  console.log(`[booking-media-gc] objetos=${objects.length} órfãos>${RETENTION_MS / 3_600_000}h=${orphans.length} modo=${APPLY ? 'apply' : 'dry-run'}`);
  for (const item of orphans) {
    console.log(`[booking-media-gc] ${APPLY ? 'removendo' : 'removeria'} tenant=${item.tenantId} asset=${item.assetId}`);
    if (APPLY) await deleteBookingMedia(item.tenantId, item.assetId);
  }
}

main()
  .catch((error) => {
    console.error('[booking-media-gc] falhou:', error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
