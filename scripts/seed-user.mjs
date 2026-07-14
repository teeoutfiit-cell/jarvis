// scripts/seed-user.mjs
//
// Preenche o Second Brain do Erik na PRÓPRIA conta dele, uma vez, depois de
// criar login pelo app. NÃO faz parte do app em si (não é importado por
// nenhuma rota) e usa a SERVICE ROLE KEY, que ignora RLS — por isso roda só
// localmente, na sua máquina, nunca dentro da Vercel.
//
// Uso:
//   1. No Supabase: Settings → API → copie a "service_role" key (NÃO a anon).
//   2. export SUPABASE_URL=https://SEU-PROJETO.supabase.co
//      export SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
//      export SEED_EMAIL=seu@email.com   (o e-mail que você usou pra logar no Jarvis)
//   3. node scripts/seed-user.mjs
//
// É seguro rodar mais de uma vez: só preenche notes/edges se ainda estiverem
// vazios (não sobrescreve nada que você já editou pela interface).

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL = process.env.SEED_EMAIL;

if (!SUPABASE_URL || !SERVICE_KEY || !EMAIL) {
  console.error('Faltou definir SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY ou SEED_EMAIL.');
  process.exit(1);
}

const ERIK_NOTES = [
  { id: 'n1', area: 'metas', title: 'Erizon AI', body: 'Consolidar a Erizon AI como um Sistema Operacional Inteligente para Empresas — SaaS multi-tenant com memória empresarial, Executive Feed, Pulse, NeuroScore e Client DNA. Quanto mais usa, mais inteligente fica.' },
  { id: 'n2', area: 'metas', title: 'Escalar Bound', body: 'Estruturar e escalar a agência Bound: plano de turnaround com health score de clientes, cadência de comunicação e novo formato de reuniões.' },
  { id: 'n3', area: 'trabalho', title: 'CEO Erizon', body: 'Erik é CEO e único operador da Erizon AI. Cuida de produto, arquitetura técnica e desenvolvimento, usando Claude Code como ferramenta agêntica principal.' },
  { id: 'n4', area: 'trabalho', title: 'Agência Bound', body: 'Na Bound (agência co-gerida com familiares), Erik gerencia campanhas de Meta Ads para clientes imobiliários e SMBs, incluindo relatórios de performance e estruturas completas de campanha.' },
  { id: 'n5', area: 'projetos', title: 'CRM Erizon', body: 'Desenvolvendo o CRM da Erizon: reordenação do Kanban de pipeline, agendamento de visitas com integração de calendário e ativação de páginas placeholder.' },
  { id: 'n6', area: 'projetos', title: 'Segurança', body: 'Auditoria técnica de 10 rodadas concluída no código da Erizon (secrets, IDOR, tokens OAuth em texto plano, RLS, rate limiting). Restam 4 gaps: caminhos de armazenamento de tokens OAuth e validação de assinatura de webhooks.' },
  { id: 'n7', area: 'projetos', title: 'Prospector', body: 'Erizon Prospector: ferramenta de prospecção B2B em Next.js + Supabase + Groq. Bloqueio recorrente resolvido: o próprio Jarvis agora prospecta via Google Places API.' },
  { id: 'n8', area: 'projetos', title: 'Creative Ops', body: 'Erizon Creative Ops: app Next.js separado para operações de criativos, com redesign faseado restrito à camada de apresentação.' },
  { id: 'n9', area: 'projetos', title: 'SDR WhatsApp', body: 'Bot SDR no WhatsApp configurado e testado para qualificação de leads da própria Erizon AI.' },
  { id: 'n10', area: 'financas', title: 'Renda extra', body: 'Avaliou operação de afiliado no TikTok Shop como fonte de renda extra sem capital inicial.' },
  { id: 'n11', area: 'aprendizado', title: 'Claude Code', body: 'Usa o framework PACE (Propósito, Atuação, Contexto, Execução) para prompts de execução no Claude Code em todos os módulos da Erizon.' },
  { id: 'n12', area: 'aprendizado', title: 'Meta API', body: 'Domínio prático da Meta Marketing API: status vs effective_status, webhooks de Lead Ads, Graph API e Lead Access Manager. Resolveu falha crítica de sync de leads da Bound.' },
  { id: 'n13', area: 'relacoes', title: 'Família', body: 'Co-administra a agência Bound com familiares.' },
  { id: 'n14', area: 'relacoes', title: 'Clientes', body: 'Carteira imobiliária da Bound: Pamela, Fran, Raquel, Vanúbia, Vanessa e Michelle, com tickets de R$800k a R$2M e framework reutilizável de públicos.' }
];

const ERIK_EDGES = [
  ['n1', 'n3'], ['n1', 'n5'], ['n1', 'n6'], ['n1', 'n7'], ['n1', 'n8'], ['n1', 'n9'],
  ['n2', 'n4'], ['n2', 'n14'], ['n2', 'n10'],
  ['n3', 'n11'], ['n4', 'n12'], ['n4', 'n13'], ['n4', 'n14'],
  ['n5', 'n11'], ['n6', 'n12'], ['n9', 'n12'], ['n7', 'n11'], ['n8', 'n11']
];

// Ajuste aqui o ICP de prospecção antes de rodar, se quiser já sair configurado.
const PROSPECTING_SEED = {
  enabled: true,
  googleApiKey: '',
  niches: ['imobiliária', 'clínica odontológica', 'academia'],
  cities: ['São Paulo, SP'],
  criteria:
    'Negócio local (não uma franquia grande nem uma rede nacional) que provavelmente ainda não investe em ' +
    'tráfego pago (Meta Ads/Google Ads) de forma profissional, tem site fraco ou inexistente, e teria orçamento ' +
    'real para contratar uma agência como a Bound.',
  minLeadsPerDay: 10,
  lastRunDate: null
};

async function main() {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  console.log('Procurando usuário com e-mail', EMAIL, '...');
  let userId = null;
  let page = 1;
  while (!userId) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email === EMAIL);
    if (found) { userId = found.id; break; }
    if (data.users.length < 200) break;
    page++;
  }
  if (!userId) {
    console.error('Não encontrei nenhum usuário com esse e-mail. Crie a conta pelo app primeiro (tela de login).');
    process.exit(1);
  }
  console.log('Usuário encontrado:', userId);

  const { data: row, error: readErr } = await admin.from('app_settings').select('data').eq('user_id', userId).maybeSingle();
  if (readErr) throw readErr;

  const settings = row ? row.data : {};
  if (!settings.notes || !settings.notes.length || (settings.notes.length === 1 && settings.notes[0].id === 'n1' && settings.notes[0].title === 'Bem-vindo')) {
    settings.notes = ERIK_NOTES;
    settings.edges = ERIK_EDGES;
    console.log('Second Brain preenchido.');
  } else {
    console.log('Second Brain já tinha notas — não sobrescrevi (apague manualmente se quiser reimportar).');
  }

  if (!settings.prospecting || !settings.prospecting.googleApiKey) {
    settings.prospecting = { ...PROSPECTING_SEED, googleApiKey: (settings.prospecting || {}).googleApiKey || '' };
    console.log('Configuração de prospecção aplicada — falta colar a chave do Google Places em ⚙ → Prospecção.');
  }

  const { error: writeErr } = await admin.from('app_settings').upsert({ user_id: userId, data: settings, updated_at: new Date().toISOString() });
  if (writeErr) throw writeErr;

  console.log('Pronto! Abra o Jarvis e confira o Second Brain e ⚙ → Prospecção.');
}

main().catch((e) => { console.error(e); process.exit(1); });
