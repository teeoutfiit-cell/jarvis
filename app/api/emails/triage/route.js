import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { loadSettings } from '@/lib/settingsStore';
import { groqChat } from '@/lib/groq';
import { heuristicTriage } from '@/lib/triage';
import { MODEL_TIERS } from '@/lib/defaultData';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const emails = (body && body.emails) || [];
  if (!emails.length) return NextResponse.json({ triage: {} });

  try {
    const ids = emails.map((m) => m.id);
    const { data: cached, error: cacheErr } = await supabase
      .from('email_triage')
      .select('message_id, balde, resumo')
      .eq('user_id', user.id)
      .in('message_id', ids);
    if (cacheErr) throw new Error(cacheErr.message);

    const cachedMap = {};
    (cached || []).forEach((row) => { cachedMap[row.message_id] = { balde: row.balde, resumo: row.resumo }; });

    const novos = emails.filter((m) => !cachedMap[m.id]);
    if (novos.length) {
      const settings = await loadSettings(supabase, user.id);
      const apiKey = (settings.groqApiKey || '').trim();
      const model = MODEL_TIERS[settings.modelTier] || MODEL_TIERS.equilibrado;
      let results = {};

      if (apiKey) {
        try {
          const lote = novos.slice(0, 40).map((m) => ({ id: m.id, de: m.de, assunto: m.assunto, trecho: (m.trecho || '').slice(0, 200) }));
          const prompt =
            'Classifique cada e-mail abaixo em UM balde: acao (pede resposta, tarefa, decisão ou tem prazo), ' +
            'info (vale saber mas não exige nada) ou ruido (promoção, newsletter, notificação automática). ' +
            'Responda APENAS um JSON array, sem markdown, formato exato: ' +
            '[{"id":"...","balde":"acao|info|ruido","resumo":"uma frase curta em português"}].\n\nE-MAILS:\n' +
            JSON.stringify(lote);

          const reply = await groqChat({
            apiKey,
            model,
            maxTokens: 1200,
            messages: [
              { role: 'system', content: 'Você retorna somente JSON válido, nunca texto explicativo nem markdown.' },
              { role: 'user', content: prompt }
            ]
          });
          const clean = reply.replace(/```json|```/g, '').trim();
          const arr = JSON.parse(clean);
          arr.forEach((item) => {
            results[item.id] = {
              balde: ['acao', 'info', 'ruido'].includes(item.balde) ? item.balde : 'info',
              resumo: item.resumo || ''
            };
          });
        } catch (e) {
          // se a IA falhar, cai no heurístico abaixo
        }
      }

      novos.forEach((m) => { if (!results[m.id]) results[m.id] = heuristicTriage(m); });

      const rows = Object.keys(results).map((id) => ({
        user_id: user.id,
        message_id: id,
        balde: results[id].balde,
        resumo: results[id].resumo,
        ts: Date.now()
      }));
      const { error: upErr } = await supabase.from('email_triage').upsert(rows);
      if (upErr) throw new Error(upErr.message);

      Object.assign(cachedMap, results);
    }

    return NextResponse.json({ triage: cachedMap });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
