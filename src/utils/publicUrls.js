/** URL pública de agendamento para clientes (página /cliente). */
export function getPublicCustomerBookingUrl() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/cliente`;
  }
  return '/cliente';
}

/** Área logada do cliente (histórico, agendamentos). */
export function getPublicCustomerPortalUrl() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/cliente/portal`;
  }
  return '/cliente/portal';
}
