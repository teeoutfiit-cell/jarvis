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

const DEFAULT_NOTES = [
  { id: 'n1', area: 'metas', title: 'Erizon AI', body: 'Consolidar a Erizon AI como um Sistema Operacional Inteligente para Empresas — SaaS multi-tenant com memória empresarial, Executive Feed, Pulse, NeuroScore e Client DNA. Quanto mais usa, mais inteligente fica.' },
  { id: 'n2', area: 'metas', title: 'Escalar Bound', body: 'Estruturar e escalar a agência Bound: plano de turnaround com health score de clientes, cadência de comunicação e novo formato de reuniões.' },
  { id: 'n3', area: 'trabalho', title: 'CEO Erizon', body: 'Erik é CEO e único operador da Erizon AI. Cuida de produto, arquitetura técnica e desenvolvimento, usando Claude Code como ferramenta agêntica principal.' },
  { id: 'n4', area: 'trabalho', title: 'Agência Bound', body: 'Na Bound (agência co-gerida com familiares), Erik gerencia campanhas de Meta Ads para clientes imobiliários e SMBs, incluindo relatórios de performance e estruturas completas de campanha.' },
  { id: 'n5', area: 'projetos', title: 'CRM Erizon', body: 'Desenvolvendo o CRM da Erizon: reordenação do Kanban de pipeline, agendamento de visitas com integração de calendário e ativação de páginas placeholder.' },
  { id: 'n6', area: 'projetos', title: 'Segurança', body: 'Auditoria técnica de 10 rodadas concluída no código da Erizon (secrets, IDOR, tokens OAuth em texto plano, RLS, rate limiting). Restam 4 gaps: caminhos de armazenamento de tokens OAuth e validação de assinatura de webhooks.' },
  { id: 'n7', area: 'projetos', title: 'Prospector', body: 'Erizon Prospector: ferramenta de prospecção B2B em Next.js + Supabase + Groq. Bloqueio recorrente: fontes gratuitas de dados com telefone.' },
  { id: 'n8', area: 'projetos', title: 'Creative Ops', body: 'Erizon Creative Ops: app Next.js separado para operações de criativos, com redesign faseado restrito à camada de apresentação.' },
  { id: 'n9', area: 'projetos', title: 'SDR WhatsApp', body: 'Bot SDR no WhatsApp configurado e testado para qualificação de leads da própria Erizon AI.' },
  { id: 'n10', area: 'financas', title: 'Renda extra', body: 'Avaliou operação de afiliado no TikTok Shop como fonte de renda extra sem capital inicial.' },
  { id: 'n11', area: 'aprendizado', title: 'Claude Code', body: 'Usa o framework PACE (Propósito, Atuação, Contexto, Execução) para prompts de execução no Claude Code em todos os módulos da Erizon.' },
  { id: 'n12', area: 'aprendizado', title: 'Meta API', body: 'Domínio prático da Meta Marketing API: status vs effective_status, webhooks de Lead Ads, Graph API e Lead Access Manager. Resolveu falha crítica de sync de leads da Bound.' },
  { id: 'n13', area: 'relacoes', title: 'Família', body: 'Co-administra a agência Bound com familiares.' },
  { id: 'n14', area: 'relacoes', title: 'Clientes', body: 'Carteira imobiliária da Bound: Pamela, Fran, Raquel, Vanúbia, Vanessa e Michelle, com tickets de R$800k a R$2M e framework reutilizável de públicos.' }
];

const DEFAULT_EDGES = [
  ['n1', 'n3'], ['n1', 'n5'], ['n1', 'n6'], ['n1', 'n7'], ['n1', 'n8'], ['n1', 'n9'],
  ['n2', 'n4'], ['n2', 'n14'], ['n2', 'n10'],
  ['n3', 'n11'], ['n4', 'n12'], ['n4', 'n13'], ['n4', 'n14'],
  ['n5', 'n11'], ['n6', 'n12'], ['n9', 'n12'], ['n7', 'n11'], ['n8', 'n11']
];

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
    notes: JSON.parse(JSON.stringify(DEFAULT_NOTES)),
    edges: JSON.parse(JSON.stringify(DEFAULT_EDGES)),
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
    lastDigestDate: null
  };
}
