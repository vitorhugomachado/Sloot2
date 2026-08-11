export const CASH_STATUS_CHANGED = 'slooti:cash-status-changed';

export function notifyCashStatusChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CASH_STATUS_CHANGED));
  }
}
