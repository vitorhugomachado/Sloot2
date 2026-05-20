const TAB_ID_KEY = 'sloot_tab_id';
const LEADER_PREFIX = 'sloot_poll_leader_';
const LEADER_TTL_MS = 20000;

function getTabId() {
  if (typeof sessionStorage === 'undefined') return 'ssr';
  let id = sessionStorage.getItem(TAB_ID_KEY);
  if (!id) {
    id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `tab_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(TAB_ID_KEY, id);
  }
  return id;
}

/** Uma aba por tenantSlug faz polling de agenda staff. */
export function shouldLeadAppointmentsPoll(tenantSlug) {
  if (typeof localStorage === 'undefined') return true;
  const slug = String(tenantSlug || '').toLowerCase();
  if (!slug) return true;

  const tabId = getTabId();
  const key = `${LEADER_PREFIX}${slug}`;
  const now = Date.now();

  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.tabId === tabId) {
        localStorage.setItem(key, JSON.stringify({ tabId, until: now + LEADER_TTL_MS }));
        return true;
      }
      if (parsed.until > now) return false;
    }
    localStorage.setItem(key, JSON.stringify({ tabId, until: now + LEADER_TTL_MS }));
    return true;
  } catch {
    return true;
  }
}

export function releaseAppointmentsPollLeadership(tenantSlug) {
  if (typeof localStorage === 'undefined') return;
  const slug = String(tenantSlug || '').toLowerCase();
  if (!slug) return;
  const key = `${LEADER_PREFIX}${slug}`;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed.tabId === getTabId()) localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
