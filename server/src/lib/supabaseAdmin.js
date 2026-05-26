const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');

let adminClient = null;

function getSupabaseServiceRoleKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    || process.env.SUPABASE_SERVICE_KEY?.trim()
  );
}

function isSupabaseAuthConfigured() {
  return Boolean(process.env.SUPABASE_URL?.trim() && getSupabaseServiceRoleKey());
}

function getSupabaseAdmin() {
  if (!isSupabaseAuthConfigured()) return null;
  if (!adminClient) {
    adminClient = createClient(process.env.SUPABASE_URL.trim(), getSupabaseServiceRoleKey(), {
      auth: { autoRefreshToken: false, persistSession: false },
      realtime: { transport: WebSocket },
    });
  }
  return adminClient;
}

module.exports = { getSupabaseAdmin, isSupabaseAuthConfigured };
