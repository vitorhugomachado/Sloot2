import { createClient } from '@supabase/supabase-js';

let browserClient = null;

export function isSupabaseConfigured() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  return Boolean(url && key);
}

export function getSupabase() {
  if (!isSupabaseConfigured()) return null;
  if (!browserClient) {
    browserClient = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY,
    );
  }
  return browserClient;
}

export function getPasswordResetRedirectUrl(tenantSlug) {
  const slug = String(tenantSlug || '').trim().toLowerCase();
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/${slug}/cliente/redefinir-senha`;
}
