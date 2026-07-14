import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { loadSettings, saveSettings } from '@/lib/settingsStore';
import { parseRss } from '@/lib/rss';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const force = new URL(req.url).searchParams.get('force') === '1';

  try {
    const settings = await loadSettings(supabase, user.id);
    const cfg = settings.newsConfig || { subjects: ['tecnologia', 'economia'], count: 5, hl: 'pt-BR', gl: 'BR', ceid: 'BR:pt-419', refreshMin: 30 };
    const cache = settings.newsCache || { ts: 0, bySubject: {} };

    const ageMin = (Date.now() - (cache.ts || 0)) / 60000;
    if (!force && ageMin < (cfg.refreshMin || 30) && Object.keys(cache.bySubject || {}).length) {
      return NextResponse.json({ bySubject: cache.bySubject, cached: true });
    }

    const bySubject = {};
    for (const subj of cfg.subjects || []) {
      try {
        const url =
          'https://news.google.com/rss/search?q=' + encodeURIComponent(subj) +
          '&hl=' + (cfg.hl || 'pt-BR') + '&gl=' + (cfg.gl || 'BR') + '&ceid=' + (cfg.ceid || 'BR:pt-419');
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JarvisNext/1.0)' },
          cache: 'no-store'
        });
        if (!res.ok) continue;
        const xml = await res.text();
        bySubject[subj] = parseRss(xml, cfg.count || 5);
      } catch (e) {
        // um assunto falhar não derruba os outros
      }
    }

    settings.newsCache = { ts: Date.now(), bySubject };
    await saveSettings(supabase, user.id, settings);

    return NextResponse.json({ bySubject, cached: false });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
