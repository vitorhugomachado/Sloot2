const { createClient } = require('@supabase/supabase-js');

let adminClient = null;

function isSupabaseAuthConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getSupabaseAdmin() {
  if (!isSupabaseAuthConfigured()) return null;
  if (!adminClient) {
    adminClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return adminClient;
}

module.exports = { getSupabaseAdmin, isSupabaseAuthConfigured };
