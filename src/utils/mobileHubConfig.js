export const DEFAULT_MOBILE_HUB_CONFIG = {
  heroTitle: 'Mais que um corte. Uma experiência.',
  heroText: 'Cada detalhe importa. Ambiente premium, atendimento de verdade e resultados que falam por si.',
  about: 'Unimos técnica, estilo e atendimento para entregar mais que um corte: uma experiência completa.',
  rating: '4,9',
  reviews: '204 avaliações',
  city: 'São Paulo, SP',
  hours: 'Seg à Sáb · 09h às 20h',
  gallery: '',
  coverUrl: '',
};

export function getMobileHubStorageKey(slug) {
  return `slooti:mobile-hub:${slug || 'default'}`;
}

export function readMobileHubConfig(slug) {
  const defaults = { ...DEFAULT_MOBILE_HUB_CONFIG };
  if (typeof window === 'undefined') return defaults;
  try {
    const stored = JSON.parse(window.localStorage.getItem(getMobileHubStorageKey(slug)) || '{}');
    return { ...defaults, ...(stored && typeof stored === 'object' ? stored : {}) };
  } catch {
    return defaults;
  }
}

export function saveMobileHubConfig(slug, config) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(getMobileHubStorageKey(slug), JSON.stringify(config));
  window.dispatchEvent(new CustomEvent('slooti:mobile-hub-updated', { detail: { slug } }));
}

export function clearMobileHubConfig(slug) {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(getMobileHubStorageKey(slug));
  window.dispatchEvent(new CustomEvent('slooti:mobile-hub-updated', { detail: { slug } }));
}
