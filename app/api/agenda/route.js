import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { loadSettings } from '@/lib/settingsStore';
import { getCachedAgenda } from '@/lib/agenda';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const force = new URL(req.url).searchParams.get('force') === '1';

  try {
    const settings = await loadSettings(supabase, user.id);
    const events = await getCachedAgenda(supabase, user.id, settings, force, 10);
    return NextResponse.json({ events });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
