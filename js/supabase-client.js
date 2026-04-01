// ===== js/supabase-client.js =====
// Initialisation du client Supabase

const supabaseClient = window.supabase.createClient(
  SUPABASE_CONFIG.url,
  SUPABASE_CONFIG.anonKey
);

window.supabaseClient = supabaseClient;

console.log('✅ Client Supabase initialisé');
