import { API_URL } from '../../config/apiUrl';

const TOKEN_KEY = 'sloot_platform_token';

export function getPlatformToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setPlatformToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function platformFetch(path, options = {}) {
  const token = getPlatformToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || 'Erro na requisição');
    err.status = res.status;
    throw err;
  }
  return data;
}

export function tenantPublicUrls(slug) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return {
    cliente: `${origin}/${slug}/cliente`,
    staffLogin: `${origin}/${slug}/barbeiros/login`,
    staffPanel: `${origin}/${slug}/barbeiros`,
  };
}

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
