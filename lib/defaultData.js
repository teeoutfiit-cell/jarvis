export const AREA = {
  metas: { label: 'Metas', color: '#fbbf24' },
  trabalho: { label: 'Carreira', color: '#ff5547' },
  projetos: { label: 'Projetos', color: '#8b7cff' },
  financas: { label: 'Finanças', color: '#f7931a' },
  aprendizado: { label: 'Aprendizado', color: '#2dd4ff' },
  saude: { label: 'Saúde', color: '#10b981' },
  relacoes: { label: 'Relações', color: '#ec4899' },
  meta: { label: 'Sistema', color: '#8a90a6' }
};

// Modelos Groq por nível — llama-3.3-70b-versatile e llama-3.1-8b-instant
// serão desligados pela Groq em 16/08/2026, então já entramos com os
// substitutos recomendados oficialmente.
export const MODEL_TIERS = {
  economico: 'openai/gpt-oss-20b',
  equilibrado: 'openai/gpt-oss-120b',
  maximo: 'qwen/qwen3.6-27b'
};

// Estado inicial de QUALQUER conta nova — genérico, sem dados de ninguém.
// O conteúdo real do Second Brain de um usuário específico nunca entra aqui:
// ele é preenchido pela própria pessoa pela interface, ou (no caso do Erik)
// por scripts/seed-user.mjs, que roda uma vez fora do app.
export function defaultSettings() {
  return {
    name: 'Jarvis',
    address: 'senhor',
    themeColor: '#2dd4ff',
    persona: 'formal britânico (mordomo)',
    wakeWord: 'ei jarvis',
    voiceGender: 'masculina',
    modelTier: 'equilibrado',
    groqApiKey: '',
    timezone: 'America/Sao_Paulo',
    notes: [
      { id: 'n1', area: 'meta', title: 'Bem-vindo', body: 'Este é o seu Second Brain. Clique no + para adicionar notas sobre suas metas, projetos, carreira e relações — o Jarvis usa isso para personalizar tudo o que fala com você.' }
    ],
    edges: [],
    calendars: [
      { id: 'cal1', name: 'Agenda 1', color: '#2dd4ff', icsUrl: '' },
      { id: 'cal2', name: 'Agenda 2', color: '#8b7cff', icsUrl: '' }
    ],
    emailAccounts: [
      { id: 'em1', alias: 'Pessoal', color: '#2dd4ff', host: 'imap.gmail.com', email: '', senhaApp: '' }
    ],
    newsConfig: { subjects: ['tecnologia', 'economia'], count: 5, hl: 'pt-BR', gl: 'BR', ceid: 'BR:pt-419', refreshMin: 30 },
    newsCache: { ts: 0, bySubject: {} },
    agendaCache: { ts: 0, events: [] },
    weather: { city: '', lat: null, lon: null },
    lastDigestDate: null,
    prospecting: {
      enabled: false,
      googleApiKey: '',
      niches: ['imobiliária'],
      cities: ['São Paulo, SP'],
      criteria: 'Negócio local que provavelmente ainda não investe em tráfego pago (Meta Ads/Google Ads) e teria orçamento para contratar uma agência de marketing digital.',
      minLeadsPerDay: 10,
      lastRunDate: null
    }
  };
}
