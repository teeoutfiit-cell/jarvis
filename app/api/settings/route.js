import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { loadSettings, saveSettings } from '@/lib/settingsStore';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const settings = await loadSettings(supabase, user.id);
    return NextResponse.json({ settings });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || !body.settings) {
    return NextResponse.json({ error: 'faltou settings no corpo' }, { status: 400 });
  }

  try {
    await saveSettings(supabase, user.id, body.settings);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
