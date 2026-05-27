function paymentsChanged(a, b) {
  return JSON.stringify(a?.payments ?? null) !== JSON.stringify(b?.payments ?? null);
}

/** true se houve mudança relevante para o feed de atividade. */
export function appointmentHasActivityChange(oldApp, newApp) {
  if (!oldApp) return true;
  return (
    oldApp.status !== newApp.status
    || oldApp.service !== newApp.service
    || oldApp.price !== newApp.price
    || oldApp.time !== newApp.time
    || oldApp.date !== newApp.date
    || paymentsChanged(oldApp, newApp)
  );
}

export function mergeAppointmentActivity(oldApp, newApp, now = Date.now()) {
  if (!oldApp) return { ...newApp, _updatedAtLocal: now };
  if (appointmentHasActivityChange(oldApp, newApp)) {
    return { ...newApp, _updatedAtLocal: now };
  }
  if (oldApp._updatedAtLocal) {
    return { ...newApp, _updatedAtLocal: oldApp._updatedAtLocal };
  }
  return newApp;
}

export function mergeAppointmentsWithActivity(prev, data, now = Date.now()) {
  if (!Array.isArray(data)) return prev;
  const prevMap = new Map(prev.map((app) => [Number(app.id), app]));
  return data.map((app) => mergeAppointmentActivity(prevMap.get(Number(app.id)), app, now));
}
