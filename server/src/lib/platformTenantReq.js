/** Helpers for platform-scoped tenant operations (no X-Tenant-Slug). */

function tenantIdFromPlatformReq(req) {
  if (!req.tenant?.id) {
    throw new Error('tenantIdFromPlatformReq called without req.tenant');
  }
  return req.tenant.id;
}

function tenantWhereFromPlatformReq(req, extra = {}) {
  return { tenantId: tenantIdFromPlatformReq(req), ...extra };
}

module.exports = {
  tenantIdFromPlatformReq,
  tenantWhereFromPlatformReq,
};
