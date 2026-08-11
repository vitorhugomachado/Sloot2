const EVENT = 'slooti:staff-toast';

export function showStaffToast(message, { variant = 'info', duration = 3500 } = {}) {
  if (!message) return;
  window.dispatchEvent(new CustomEvent(EVENT, {
    detail: { message: String(message), variant, duration },
  }));
}

export function showFinanceError(err, options = {}) {
  const code = err?.code;
  const message = err?.message || err?.body?.error || 'Operação falhou';

  if (code === 'CASH_CLOSED' || code === 'CASH_REQUIRED' || /caixa/i.test(message)) {
    showStaffToast(message, { variant: 'warning', duration: 4500 });
    options.onCashAction?.();
    return;
  }

  if (code === 'OPEN_COMANDAS') {
    showStaffToast(message, { variant: 'warning', duration: 5000 });
    options.onOpenComandas?.(err);
    return;
  }

  if (code === 'PERIOD_CLOSED') {
    showStaffToast(message, { variant: 'error', duration: 5000 });
    return;
  }

  showStaffToast(message, { variant: 'error' });
}

export { EVENT as STAFF_TOAST_EVENT };
