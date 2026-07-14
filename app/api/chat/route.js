import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { loadSettings, saveSettings } from '@/lib/settingsStore';
import { getCachedAgenda, todayEventsCompact } from '@/lib/agenda';
import { buildSystemPrompt, extractSaves } from '@/lib/prompt';
import { groqChat } from '@/lib/groq';
import { MODEL_TIERS } from '@/lib/defaultData';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const message = body && body.message;
  const history = (body && body.history) || [];
  if (!message) return NextResponse.json({ error: 'faltou message' }, { status: 400 });

  try {
    const settings = await loadSettings(supabase, user.id);
    const apiKey = (settings.groqApiKey || '').trim();
    if (!apiKey) {
      return NextResponse.json({
        reply: `Preciso da sua chave da Groq, ${settings.address}. Cole a API key em ⚙ Configurações → Motor.`,
        notesChanged: false
      });
    }

    const events = await getCachedAgenda(supabase, user.id, settings, false, 10);
    const agendaCompact = todayEventsCompact(events);

    const { count } = await supabase
      .from('email_triage')
      .select('message_id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('balde', 'acao');

    const model = MODEL_TIERS[settings.modelTier] || MODEL_TIERS.equilibrado;
    const systemPrompt = buildSystemPrompt({
      settings,
      agendaCompact,
      emailActionCompact: `E-mails pedindo ação: ${count || 0}.`
    });

    const messages = [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: message }];
    const rawReply = await groqChat({ apiKey, model, maxTokens: 400, messages });

    const notes = settings.notes || [];
    const { cleaned, changed, changedIds } = extractSaves(rawReply, notes);
    if (changed) {
      settings.notes = notes;
      await saveSettings(supabase, user.id, settings);
    }

    return NextResponse.json({ reply: cleaned, notesChanged: changed, changedIds });
  } catch (e) {
    return NextResponse.json(
      { reply: 'Houve um erro na conexão com o cérebro. Verifique se a chave da Groq está correta.', error: e.message },
      { status: 200 }
    );
  }
}
