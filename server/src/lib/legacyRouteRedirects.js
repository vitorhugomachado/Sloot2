/**
 * Redirects 301 de rotas antigas com slug explícito (/{slug}/cliente, /{slug}/barbeiros).
 * Paths na raiz (/cliente, /barbeiros) não redirecionam — o SPA envia para a landing.
 */

function mapClienteRest(rest) {
  if (!rest || rest === '/') return '';
  if (rest === '/portal' || rest.startsWith('/portal/')) return '/portal';
  if (rest === '/redefinir-senha' || rest.startsWith('/redefinir-senha')) {
    return '/redefinir-senha';
  }
  return '';
}

function mapBarbeirosRest(rest) {
  if (!rest || rest === '/') return '/dashboard';
  if (rest === '/login' || rest.startsWith('/login/')) return '/login';
  const tab = rest.replace(/^\//, '').split('/')[0];
  if (!tab) return '/dashboard';
  if (tab === 'login') return '/login';
  return `/dashboard/${tab}`;
}

/**
 * @param {string} path req.path (sem query)
 * @returns {string|null} destino ou null
 */
function resolveLegacyRedirect(path) {
  const p = path || '/';

  const tenantMatch = p.match(/^\/([a-z0-9]+(?:-[a-z0-9]+)*)(\/.*)?$/);
  if (!tenantMatch) return null;

  const slug = tenantMatch[1];
  const rest = tenantMatch[2] || '';

  if (rest === '/cliente' || rest.startsWith('/cliente/')) {
    const sub = rest.slice('/cliente'.length);
    return `/${slug}${mapClienteRest(sub)}`;
  }
  if (rest === '/barbeiros' || rest.startsWith('/barbeiros/')) {
    const sub = rest.slice('/barbeiros'.length);
    return `/${slug}${mapBarbeirosRest(sub)}`;
  }
  if (rest === '/admin' || rest.startsWith('/admin/')) {
    return '/admin';
  }

  return null;
}

module.exports = {
  resolveLegacyRedirect,
  mapClienteRest,
  mapBarbeirosRest,
};
