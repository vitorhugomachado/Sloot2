/** Número com DDI (ex. 5511999999999). Defina VITE_LANDING_WHATSAPP_PHONE no .env */
const WHATSAPP_PHONE = (
  import.meta.env.VITE_LANDING_WHATSAPP_PHONE || '5511999999999'
).replace(/\D/g, '');

function buildWhatsAppUrl(message) {
  return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;
}

export const LANDING_WHATSAPP_URL = buildWhatsAppUrl(
  'Olá! Quero saber mais sobre o Slooti para minha barbearia.',
);
