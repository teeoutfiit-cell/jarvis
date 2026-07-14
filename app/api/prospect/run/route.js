import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runProspectingForUser } from '@/lib/prospect';

// Alvo do Vercel Cron (ver vercel.json). Roda 1x/dia, autenticado pelo
// CRON_SECRET que a própria Vercel envia automaticamente.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req) {
  const auth = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: rows, error } = await admin.from('app_settings').select('user_id, data');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = [];
  for (const row of rows || []) {
    const settings = row.data || {};
    if (!settings.prospecting || !settings.prospecting.enabled) continue;
    try {
      const r = await runProspectingForUser(admin, row.user_id, settings);
      settings.prospecting.lastRunDate = new Date().toISOString();
      await admin.from('app_settings').update({ data: settings, updated_at: new Date().toISOString() }).eq('user_id', row.user_id);
      results.push({ user_id: row.user_id, ...r });
    } catch (e) {
      results.push({ user_id: row.user_id, error: e.message });
    }
  }

  return NextResponse.json({ ok: true, results });
}
