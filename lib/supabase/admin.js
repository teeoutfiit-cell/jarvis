import { createClient } from '@supabase/supabase-js';

// ⚠️ Ignora RLS — usar SOMENTE em rotas server-only que não recebem input
// arbitrário de um usuário autenticado (ex: o cron de prospecção, que precisa
// iterar sobre TODOS os usuários). Nunca importar isto em código de cliente
// nem em rotas que atuam "em nome" de uma sessão de usuário comum.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
