import { API_URL } from '../../config/apiUrl';

const TOKEN_KEY = 'sloot_platform_token';

export function getPlatformToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setPlatformToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

function normalizeApiBase() {
  return String(API_URL || '/api').trim().replace(/\/$/, '') || '/api';
}

function apiBaseIncludesPlatform(base) {
  return base.endsWith('/platform');
}

/**
 * Monta o path da API platform sem duplicar /platform.
 * @param {string} path ex. "/tenants/1", "/platform/tenants/1", "/stats"
 */
export function platformApiPath(path) {
  let segment = String(path || '').trim();
  if (!segment.startsWith('/')) segment = `/${segment}`;

  segment = segment.replace(/^\/platform(?=\/|$)/, '') || '/';

  const base = normalizeApiBase();
  if (apiBaseIncludesPlatform(base)) {
    return segment.startsWith('/') ? segment : `/${segment}`;
  }

  return segment === '/' ? '/platform' : `/platform${segment}`;
}

export function platformApiUrl(path) {
  return `${normalizeApiBase()}${platformApiPath(path)}`;
}

export async function platformFetch(path, options = {}) {
  const token = getPlatformToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const url = platformApiUrl(path);
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || `Erro na requisição (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

/** Operações scoped por barbearia: GET /api/platform/tenants/{tenantId}/... */
export async function platformTenantFetch(tenantId, path, options = {}) {
  const id = String(tenantId || '').trim();
  if (!/^\d+$/.test(id)) {
    throw new Error('ID da barbearia inválido.');
  }
  let segment = String(path || '').trim();
  if (!segment.startsWith('/')) segment = `/${segment}`;
  return platformFetch(`/tenants/${id}${segment}`, options);
}

/** ID numérico da barbearia a partir da rota /admin/barbearias/:id */
export function resolvePlatformTenantId(params, pathname = '') {
  const raw = params?.id ?? params?.tenantId;
  if (raw != null && /^\d+$/.test(String(raw))) return String(raw);
  const match = String(pathname).match(/\/admin\/barbearias\/(\d+)/);
  return match?.[1] ?? null;
}

export { tenantPublicUrls } from '../../constants/tenantRoutes';

export function slugify(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function validateStrongPassword(password) {
  const pwd = String(password || '');
  if (pwd.length < 8) return 'Senha deve ter pelo menos 8 caracteres.';
  if (!/[A-Z]/.test(pwd)) return 'Senha deve ter pelo menos uma letra maiúscula.';
  if (!/[a-z]/.test(pwd)) return 'Senha deve conter pelo menos uma letra minúscula.';
  if (!/[0-9]/.test(pwd)) return 'Senha deve conter pelo menos um número.';
  return null;
}

export function buildTenantListQuery({ q = '', status = '', sort = 'createdAt_desc' } = {}) {
  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q.trim());
  if (status) params.set('status', status);
  if (sort) params.set('sort', sort);
  const qs = params.toString();
  return qs ? `/tenants?${qs}` : '/tenants';
}
