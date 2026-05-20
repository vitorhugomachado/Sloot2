import { DEFAULT_SLUG } from '../context/TenantContext';

/** URL pública de agendamento para clientes (página /:slug/cliente). */
export function getPublicCustomerBookingUrl(tenantSlug) {
  const slug = String(tenantSlug || DEFAULT_SLUG).trim().toLowerCase() || DEFAULT_SLUG;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/${slug}/cliente`;
  }
  return `/${slug}/cliente`;
}

/** Área logada do cliente (histórico, agendamentos). */
export function getPublicCustomerPortalUrl(tenantSlug) {
  const slug = String(tenantSlug || DEFAULT_SLUG).trim().toLowerCase() || DEFAULT_SLUG;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/${slug}/cliente/portal`;
  }
  return `/${slug}/cliente/portal`;
}
