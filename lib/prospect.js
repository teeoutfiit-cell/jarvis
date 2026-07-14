import { searchPlaces } from './places';
import { groqChat } from './groq';
import { MODEL_TIERS } from './defaultData';

const MAX_COMBOS_PER_RUN = 8; // controla custo/tempo — 8 buscas ~ centavos de dólar

function heuristicScore(lead) {
  let score = 40;
  if (lead.site) score += 15;
  if (lead.rating != null) score += 10;
  if ((lead.avaliacoes || 0) >= 5) score += 10;
  if ((lead.avaliacoes || 0) >= 30) score += 10; // negócio ativo, mas não necessariamente uma rede grande
  return Math.min(score, 90);
}

async function qualifyWithGroq({ apiKey, model, criteria, contextoNegocio, candidatos }) {
  const lote = candidatos.map((c) => ({
    placeId: c.placeId,
    nome: c.nome,
    endereco: c.endereco,
    rating: c.rating,
    avaliacoes: c.avaliacoes,
    site: c.site ? 'tem site' : 'sem site'
  }));

  const prompt =
    `Contexto do meu negócio: ${contextoNegocio}\n\n` +
    `Critério de qualificação de lead: ${criteria}\n\n` +
    'Avalie cada candidato abaixo e dê uma nota de 0 a 100 (o quanto ele se encaixa no critério) e uma justificativa ' +
    'curta em português (1 frase, prática, do tipo "site desatualizado e poucas avaliações, provável baixo investimento ' +
    'em marketing hoje"). Responda APENAS um JSON array, sem markdown, formato exato: ' +
    '[{"placeId":"...","score":0-100,"qualificacao":"..."}].\n\nCANDIDATOS:\n' +
    JSON.stringify(lote);

  const reply = await groqChat({
    apiKey,
    model,
    maxTokens: 1500,
    messages: [
      { role: 'system', content: 'Você retorna somente JSON válido, nunca texto explicativo nem markdown.' },
      { role: 'user', content: prompt }
    ]
  });
  const clean = reply.replace(/```json|```/g, '').trim();
  const arr = JSON.parse(clean);
  const map = {};
  arr.forEach((item) => { map[item.placeId] = { score: Math.max(0, Math.min(100, item.score || 0)), qualificacao: item.qualificacao || '' }; });
  return map;
}

// Roda a prospecção pra UM usuário (usado tanto pelo cron quanto pelo "rodar agora" manual).
// `supabase` pode ser um client comum (RLS, sessão do próprio usuário) ou o admin client (cron).
export async function runProspectingForUser(supabase, userId, settings) {
  const cfg = settings.prospecting || {};
  if (!cfg.enabled) return { skipped: true, reason: 'desativado' };

  const apiKey = (cfg.googleApiKey || '').trim();
  if (!apiKey) return { skipped: true, reason: 'sem chave do Google Places' };

  const niches = (cfg.niches || []).map((s) => s.trim()).filter(Boolean);
  const cities = (cfg.cities || []).map((s) => s.trim()).filter(Boolean);
  if (!niches.length || !cities.length) return { skipped: true, reason: 'sem nichos ou cidades configurados' };

  const combos = [];
  outer: for (const city of cities) {
    for (const niche of niches) {
      combos.push({ niche, city, query: `${niche} em ${city}` });
      if (combos.length >= MAX_COMBOS_PER_RUN) break outer;
    }
  }

  let candidatos = [];
  const errosBusca = [];
  for (const combo of combos) {
    try {
      const found = await searchPlaces({ apiKey, query: combo.query, maxResults: 20 });
      found.forEach((f) => candidatos.push({ ...f, origem_busca: combo.query, categoria: combo.niche }));
    } catch (e) {
      errosBusca.push(combo.query + ': ' + e.message);
    }
  }

  // dedupe dentro do próprio lote (mesma empresa pode aparecer em buscas diferentes)
  const porPlaceId = {};
  candidatos.forEach((c) => { if (!porPlaceId[c.placeId]) porPlaceId[c.placeId] = c; });
  candidatos = Object.values(porPlaceId);

  if (!candidatos.length) {
    return { found: 0, novos: 0, qualificados: 0, erros: errosBusca };
  }

  const rows = candidatos.map((c) => ({
    user_id: userId,
    place_id: c.placeId,
    nome: c.nome,
    telefone: c.telefone,
    endereco: c.endereco,
    categoria: c.categoria,
    site: c.site,
    rating: c.rating,
    avaliacoes: c.avaliacoes,
    origem_busca: c.origem_busca,
    status: 'novo'
  }));

  // insere ignorando quem já existe (mesma empresa vista em dias anteriores) —
  // só os que realmente são novos voltam no .select()
  const { data: inserted, error: insErr } = await supabase
    .from('leads')
    .upsert(rows, { onConflict: 'user_id,place_id', ignoreDuplicates: true })
    .select('id, place_id, nome, endereco, rating, avaliacoes, site');

  if (insErr) throw new Error(insErr.message);
  const novos = inserted || [];

  let qualificados = 0;
  if (novos.length) {
    const groqKey = (settings.groqApiKey || '').trim();
    const model = MODEL_TIERS[settings.modelTier] || MODEL_TIERS.equilibrado;
    let scoreMap = {};

    if (groqKey) {
      try {
        const contexto = (settings.notes || [])
          .filter((n) => n.area === 'trabalho' || n.area === 'projetos')
          .slice(0, 4)
          .map((n) => n.title + ': ' + n.body)
          .join(' ') || 'Agência/negócio de marketing digital.';
        scoreMap = await qualifyWithGroq({
          apiKey: groqKey,
          model,
          criteria: cfg.criteria || 'Negócio local com potencial de investir em marketing digital.',
          contextoNegocio: contexto,
          candidatos: novos.map((n) => ({ placeId: n.place_id, nome: n.nome, endereco: n.endereco, rating: n.rating, avaliacoes: n.avaliacoes, site: n.site }))
        });
      } catch (e) {
        // cai no heurístico abaixo
      }
    }

    for (const n of novos) {
      const q = scoreMap[n.place_id];
      const score = q ? q.score : heuristicScore(n);
      const qualificacao = q ? q.qualificacao : 'Qualificação automática por heurística (sem IA): ' +
        (n.site ? 'tem site' : 'sem site') + ', ' + (n.avaliacoes || 0) + ' avaliações.';
      await supabase.from('leads').update({ score, qualificacao }).eq('user_id', userId).eq('place_id', n.place_id);
      qualificados++;
    }
  }

  return { found: candidatos.length, novos: novos.length, qualificados, erros: errosBusca };
}
