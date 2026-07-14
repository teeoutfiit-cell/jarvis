-- ═══════════════════════════════════════════════════════════════
-- JARVIS — schema do Supabase
-- Rode isto inteiro no SQL Editor do seu projeto Supabase
-- (app.supabase.com/project/_/sql/new), uma vez só.
-- ═══════════════════════════════════════════════════════════════

-- Tudo que é config/estado do usuário (nome, tema, wake word, motor,
-- chave da Groq, agendas, contas de e-mail, Second Brain, notícias,
-- clima, último digest) fica num único blob jsonb por usuário.
-- Simples de ler/gravar, e a RLS já garante que cada um só vê o seu.
create table if not exists app_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Cache de triagem de e-mail (AÇÃO/INFO/RUÍDO), por Message-ID.
-- Fica em tabela própria (não no jsonb) porque cresce com o tempo
-- e é consultado por chave (message_id) a cada atualização.
create table if not exists email_triage (
  user_id uuid not null references auth.users(id) on delete cascade,
  message_id text not null,
  balde text not null check (balde in ('acao', 'info', 'ruido')),
  resumo text,
  ts bigint,
  primary key (user_id, message_id)
);

alter table app_settings enable row level security;
alter table email_triage enable row level security;

drop policy if exists "own settings" on app_settings;
create policy "own settings" on app_settings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own triage" on email_triage;
create policy "own triage" on email_triage
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Índice para limpar/paginar a triagem por data se precisar no futuro.
create index if not exists email_triage_ts_idx on email_triage (user_id, ts desc);
