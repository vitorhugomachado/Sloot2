import { DEFAULT_SLUG } from '../context/TenantContext';
import {
  tenantBookingPath,
  tenantPortalPath,
} from '../constants/tenantRoutes';

/** URL pública de agendamento (/:slug). */
export function getPublicCustomerBookingUrl(tenantSlug) {
  const slug = String(tenantSlug || DEFAULT_SLUG).trim().toLowerCase() || DEFAULT_SLUG;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${tenantBookingPath(slug)}`;
  }
  return tenantBookingPath(slug);
}

/** Área logada do cliente (histórico, agendamentos). */
export function getPublicCustomerPortalUrl(tenantSlug) {
  const slug = String(tenantSlug || DEFAULT_SLUG).trim().toLowerCase() || DEFAULT_SLUG;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${tenantPortalPath(slug)}`;
  }
  return tenantPortalPath(slug);
}
