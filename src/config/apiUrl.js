/**
 * Base da API para fetch (ex.: `/api` ou URL absoluta).
 * - Padrão `/api`: no `npm run dev` o Vite faz proxy para o backend em 127.0.0.1:3001,
 *   funcionando no PC e no celular na mesma rede (o host da página é o do Vite).
 * - Produção: Express serve o SPA e monta `/api` na mesma origem — `/api` continua válido.
 * - Opcional: defina `VITE_API_URL` no `.env` (ex.: backend remoto).
 */
export function getApiUrl() {
  const raw = import.meta.env.VITE_API_URL;
  if (raw != null && String(raw).trim() !== '') {
    return String(raw).trim().replace(/\/$/, '');
  }
  return '/api';
}

export const API_URL = getApiUrl();
