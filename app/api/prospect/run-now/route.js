import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { loadSettings, saveSettings } from '@/lib/settingsStore';
import { runProspectingForUser } from '@/lib/prospect';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const settings = await loadSettings(supabase, user.id);
    const result = await runProspectingForUser(supabase, user.id, settings);
    settings.prospecting = settings.prospecting || {};
    settings.prospecting.lastRunDate = new Date().toISOString();
    await saveSettings(supabase, user.id, settings);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
