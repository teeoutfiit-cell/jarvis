import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { loadSettings, saveSettings } from '@/lib/settingsStore';
import { getCachedAgenda, todayEventsCompact } from '@/lib/agenda';
import { buildSystemPrompt } from '@/lib/prompt';
import { groqChat } from '@/lib/groq';
import { MODEL_TIERS } from '@/lib/defaultData';
import { getWeatherToday, ensureWeatherCoords, WMO } from '@/lib/weather';
import { cleanNewsTitle } from '@/lib/rss';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const settings = await loadSettings(supabase, user.id);
    const now = new Date();
    const dias = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
    const dataStr = dias[now.getDay()] + ', ' + String(now.getDate()).padStart(2, '0') + '/' + String(now.getMonth() + 1).padStart(2, '0');

    const weather = await getWeatherToday(settings.weather);
    if (settings.weather) await ensureWeatherCoords(settings.weather); // persiste lat/lon se acabou de geocodificar
    const weatherLine = weather
      ? `Clima hoje: máxima ${weather.max}°, mínima ${weather.min}°, ${WMO[weather.code] || 'tempo variável'}.`
      : '';

    const events = await getCachedAgenda(supabase, user.id, settings, false, 10);
    const agendaLine = todayEventsCompact(events);

    const { data: acaoRows } = await supabase
      .from('email_triage')
      .select('resumo')
      .eq('user_id', user.id)
      .eq('balde', 'acao')
      .order('ts', { ascending: false })
      .limit(5);
    const acaoCount = (acaoRows || []).length;
    const emailLine = `E-mails pedindo ação: ${acaoCount}. ` + (acaoRows || []).map((r) => r.resumo).filter(Boolean).join(' ');

    const headlines = [];
    Object.keys(settings.newsCache?.bySubject || {}).forEach((subj) => {
      (settings.newsCache.bySubject[subj] || []).slice(0, 3).forEach((it) => headlines.push(subj + ': ' + cleanNewsTitle(it.title)));
    });
    const headlinesLine = headlines.slice(0, 9).join(' | ');

    const metas = (settings.notes || []).filter((n) => n.area === 'metas').slice(0, 2).map((n) => n.title + ': ' + n.body).join(' ');

    const pacote = [
      `Hoje é ${dataStr}.`,
      weatherLine,
      agendaLine,
      emailLine,
      headlinesLine ? `Manchetes: ${headlinesLine}` : '',
      metas ? `Metas: ${metas}` : ''
    ].filter(Boolean).join('\n');

    const apiKey = (settings.groqApiKey || '').trim();
    const model = MODEL_TIERS[settings.modelTier] || MODEL_TIERS.equilibrado;
    let texto = '';

    if (apiKey) {
      try {
        const systemPrompt =
          buildSystemPrompt({ settings, agendaCompact: agendaLine, emailActionCompact: `E-mails pedindo ação: ${acaoCount}.` }) +
          '\n\nAgora monte o MORNING DIGEST: um briefing corrido, natural, de uns 30 segundos falados, cobrindo saudação, ' +
          'agenda, e-mails de ação e manchetes, terminando com uma frase de foco do dia conectada às metas do usuário.';
        texto = await groqChat({
          apiKey,
          model,
          maxTokens: 500,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: 'Monte meu briefing de hoje com base nisto:\n' + pacote }
          ]
        });
      } catch (e) {
        // cai no fallback offline abaixo
      }
    }

    if (!texto) {
      texto =
        `Bom dia, ${settings.address}. Hoje é ${dataStr}. ${weatherLine} ${agendaLine} ${emailLine}` +
        (headlinesLine ? ` Nas notícias: ${headlinesLine}.` : '') +
        (metas ? ` Foco do dia: ${metas}.` : '');
    }

    settings.lastDigestDate = now.toDateString();
    await saveSettings(supabase, user.id, settings);

    return NextResponse.json({ text: texto });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
