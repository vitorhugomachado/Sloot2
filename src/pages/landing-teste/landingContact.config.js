/** Número com DDI (ex. 5544997641168). Defina VITE_LANDING_WHATSAPP_PHONE no .env */
const WHATSAPP_PHONE = (
  import.meta.env.VITE_LANDING_WHATSAPP_PHONE || '5544997641168'
).replace(/\D/g, '');

export function buildWhatsAppUrl(message) {
  return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;
}

export const LANDING_WHATSAPP_URL = buildWhatsAppUrl(
  'Olá! Quero saber mais sobre o Slooti para minha barbearia.',
);

export const STUDIO_WHATSAPP_URL = buildWhatsAppUrl(
  'Olá! Vim pelo site da Slooti e quero falar com a equipe.',
);
