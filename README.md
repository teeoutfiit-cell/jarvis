# JARVIS — Next.js + Supabase + Groq

Migração da versão em arquivo único (HTML + antena local) para um app de verdade:
**Next.js 16 (App Router) · Supabase (Auth + Postgres) · Groq · deploy na Vercel**.

Tudo que antes vivia no `localStorage` do seu navegador agora fica no Supabase,
protegido por login — dá pra acessar de qualquer aparelho com sua conta.

## Novidades desta versão

- 🐛 **Corrigido**: contas novas não herdam mais o Second Brain do Erik — cada
  cadastro começa vazio/genérico. O conteúdo real do Erik agora vem de
  `scripts/seed-user.mjs`, rodado uma vez, fora do app (veja a seção 4).
- 🐛 **Corrigido**: "hoje"/"agora" no Digest, no chat e na janela da agenda
  agora são calculados no fuso configurado (`America/Sao_Paulo` por padrão),
  não mais no UTC do servidor — antes, perto da meia-noite no Brasil, o
  Digest podia achar que já era o dia seguinte.
- 🎯 **Novo módulo: Prospecção de Clientes** — busca diária automática de
  negócios locais (nome, telefone, endereço) via Google Places API,
  qualificados pela Groq usando o que o Jarvis sabe do seu negócio no Second
  Brain. Ver seção 7.

## Stack

- **Next.js 16** (App Router, Route Handlers em Node.js runtime)
- **Supabase**: Auth (email/senha) + Postgres (RLS por usuário)
- **Groq**: motor de IA (chat, triagem de e-mails, digest, qualificação de leads)
- **Google Places API (New)**: fonte de dados da prospecção
- **Vercel**: hospedagem + Cron Jobs (busca diária)
- Zero frameworks de CSS — o mesmo tema dark sci-fi de sempre, em CSS puro

## 1. Criar o projeto no Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Vá em **SQL Editor** → cole o conteúdo de `supabase/schema.sql` → **Run**.
   Isso cria as tabelas `app_settings`, `email_triage` e `leads`, todas com
   RLS habilitada (cada usuário só vê os próprios dados).
3. Vá em **Settings → API** e copie:
   - **Project URL**
   - **anon / publishable key**
   - **service_role key** (⚠️ secreta — nunca vai no navegador)

## 2. Configurar variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha (veja os comentários de
cada variável no próprio arquivo — `SUPABASE_SERVICE_ROLE_KEY` e
`CRON_SECRET` são novas nesta versão).

**Não existe variável de ambiente para a chave da Groq nem da Google Places.**
Cada usuário loga e cola as próprias em **⚙**, salvas no Supabase, protegidas
por RLS.

## 3. Rodar localmente (VS Code)

```bash
npm install
npm run dev
```

Abra `http://localhost:3000` → você cai na tela de login → crie sua conta
(email + senha) → se a confirmação por e-mail estiver ativa no seu projeto
Supabase (Authentication → Providers → Email), confirme antes de entrar.

> 🔒 **Dica de segurança**: depois de criar sua própria conta, vá em
> **Authentication → Sign In / Providers** no Supabase e desative novos
> cadastros (ou restrinja por domínio de e-mail). Assim ninguém mais consegue
> criar login no seu Jarvis, mesmo com o link público.

## 4. Preencher seu Second Brain real (uma vez, fora do app)

Depois de criar sua conta pela tela de login:

```bash
export SUPABASE_URL=https://SEU-PROJETO.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
export SEED_EMAIL=seu@email.com
npm run seed
```

Isso preenche o Second Brain do Erik (Erizon AI, Bound, clientes, etc.) e uma
configuração inicial de prospecção **só na sua conta** — nunca em contas
novas de outras pessoas. É seguro rodar de novo: só preenche o que ainda
estiver vazio.

## 5. Primeira configuração dentro do app

Depois de logado, clique em **► ATIVAR SISTEMA** → permita o microfone →
clique em **⚙**:

- **Motor**: cole sua API key da Groq (console.groq.com/keys) e escolha o
  nível (ECONÔMICO / EQUILIBRADO / MÁXIMO).
- **Agenda**: cole o link secreto iCal de cada agenda Google.
- **E-mails**: (a) ative a verificação em 2 etapas em
  myaccount.google.com/security → (b) crie uma senha de app em
  myaccount.google.com/apppasswords chamada "Jarvis" → (c) cole a senha de
  16 letras.
- **Notícias**: assuntos do radar (um por linha).
- **Digest**: cidade para a previsão do tempo.
- **Prospecção**: ver seção 7 abaixo.

Diga **"Ei Jarvis, bom dia"** para testar o Morning Digest completo.

## 6. Subir para o GitHub e fazer deploy na Vercel

```bash
git init && git add . && git commit -m "jarvis: next+supabase+prospeccao"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/jarvis.git
git push -u origin main
```

Na Vercel ([vercel.com/new](https://vercel.com/new)):

1. Importe o repositório.
2. Em **Environment Variables**, adicione as 4 do `.env.local`:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`.
3. Deploy.
4. No Supabase, vá em **Authentication → URL Configuration** e adicione a
   URL da Vercel em **Site URL** e **Redirect URLs** (com `/auth/callback`
   no final).
5. Confira em **Vercel → seu projeto → Cron Jobs** se o job
   `/api/prospect/run` apareceu (definido em `vercel.json`, roda 1x por dia
   às 10:00 UTC = 07:00 em São Paulo). No plano Hobby, o horário exato pode
   variar dentro daquela hora — é uma limitação da Vercel, não do código.

## 7. Configurar a Prospecção de Clientes

**O que ela faz**: todo dia, busca negócios locais no Google Places API
(nome, telefone, endereço, site, avaliações), descarta quem não tem telefone
ou não está mais operando, ignora quem já apareceu em dias anteriores, e
manda os candidatos novos pra Groq qualificar com base no seu critério +
no que o Jarvis já sabe do seu negócio (Second Brain).

**Passo a passo**:

1. Crie/abra um projeto no [Google Cloud Console](https://console.cloud.google.com).
2. Ative a **Places API (New)** e **ative billing** no projeto (é pago por
   uso — sem cartão cadastrado a API não funciona, mesmo com crédito grátis).
3. Crie uma API key em **APIs & Services → Credentials** e restrinja ela à
   Places API (New), por segurança.
4. No Jarvis: **⚙ → Prospecção** → cole a chave, defina nichos (ex:
   "imobiliária", "clínica odontológica") e cidades, ajuste o critério de
   qualificação em português, e ative o módulo.
5. Clique em **🔍 Buscar agora** pra testar sem esperar o cron do dia seguinte.

**Sobre custo** (verifique sempre o preço atual no Console, ele muda com
frequência): a Places API (New) cobra por SKU — pra retornar nome, endereço,
telefone e avaliação numa mesma chamada (necessário pra ter um lead útil),
o request cai no tier "Enterprise", algo na faixa de US$35 por 1.000
chamadas. Este projeto limita cada execução diária a no máximo 8 buscas
(nicho × cidade), o que dá uma fração de dólar por dia — na prática, poucos
dólares por mês mesmo em uso constante, e frequentemente coberto pelo
crédito mensal gratuito que o Google Cloud costuma oferecer.

**Deduplicação**: cada negócio (`place_id` do Google) só entra uma vez na
sua tabela de leads pra sempre — dias seguintes só trazem negócios
realmente novos que a busca ainda não tinha encontrado.

**Comando de voz**: "Ei Jarvis, meus leads" — lê os leads novos com telefone.

## Arquitetura (o que mudou da versão em arquivo único)

- A "antena" (`server.js` rodando `node server.js` num terminal à parte)
  **não existe mais** — virou Route Handlers do Next.js (`app/api/*`), que
  rodam como funções serverless na Vercel. Sem CORS, sem antena, sem terminal
  aberto.
- `app/api/emails/route.js` usa o mesmo cliente IMAP escrito na mão (só
  `tls` nativo do Node, `BODY.PEEK` pra nunca marcar e-mail como lido) —
  agora dentro de uma função serverless com `runtime = 'nodejs'`
  (obrigatório: sockets TLS crus não funcionam no Edge Runtime).
- `app/api/agenda/route.js` e `app/api/news/route.js` buscam e mesclam os
  ICS / RSS diretamente no servidor — não precisam de allowlist de proxy,
  porque não aceitam URL arbitrária vinda do cliente: só buscam as URLs já
  salvas nas configurações do próprio usuário autenticado.
- `lib/tz.js` centraliza todo cálculo de "hoje"/"agora" com fuso explícito
  (`Intl.DateTimeFormat`), usado por agenda, digest e chat — em vez de
  `new Date()` cru, que no servidor reflete UTC, não o horário do Brasil.
- `app/api/prospect/run/route.js` roda via Vercel Cron com um client
  **service role** (`lib/supabase/admin.js`, ignora RLS) porque precisa
  iterar sobre todos os usuários com prospecção ativada — algo que uma
  sessão comum de usuário não pode fazer. Protegido pelo `CRON_SECRET` que
  a própria Vercel envia automaticamente.
- Grafo neural do Second Brain: antes era SVG injetado via `innerHTML` numa
  `<div>` (truque necessário no HTML puro pra evitar bug de namespace SVG no
  Safari). Em React isso não é mais necessário — `SecondBrainGraph.js`
  retorna `<svg>` como JSX de verdade.
- Autenticação: `@supabase/ssr` com `getAll`/`setAll` (padrão atual —
  `get`/`set`/`remove` está deprecado). No Next.js 16 o middleware foi
  renomeado de `middleware.ts` para **`proxy.js`** (`async function
  proxy(request)`), que é o que este projeto usa.

## Sobre o motor (Groq)

`llama-3.3-70b-versatile` e `llama-3.1-8b-instant` serão desligados pela
Groq em **16/08/2026**. Os tiers já usam os substitutos recomendados:

| Nível | Modelo |
|---|---|
| ECONÔMICO | `openai/gpt-oss-20b` |
| EQUILIBRADO (padrão) | `openai/gpt-oss-120b` |
| MÁXIMO | `qwen/qwen3.6-27b` |

## Comandos de voz

- "Ei Jarvis, minha agenda" / "o que eu tenho hoje"
- "Ei Jarvis, próximo compromisso" / "agenda da semana"
- "Ei Jarvis, meus e-mails" / "tem e-mail importante?"
- "Ei Jarvis, notícias" / "notícias de [assunto]"
- "Ei Jarvis, meus leads" (Prospecção)
- "Ei Jarvis, bom dia" (Morning Digest)
- "Ei Jarvis, atualizar e-mails" / "atualizar notícias"

## Limitações conhecidas

- Parser ICS trata `TZID` do evento como o fuso configurado do usuário
  (aproximação razoável pra uso pessoal — não lê o TZID real do arquivo ICS).
- RRULE expande DAILY/WEEKLY/MONTHLY/YEARLY com BYDAY/COUNT/UNTIL/EXDATE
  básicos — casos exóticos (ex. BYMONTHDAY) não quebram o app, só não expandem.
- Extração de corpo de e-mail multipart é best-effort via regex, não um
  parser MIME completo — suficiente para os ~500 caracteres de trecho usados
  na triagem.
- Senha de app do Gmail e chave da Google Places ficam em texto plano no
  jsonb `app_settings` (protegido por RLS, mas não criptografado em
  repouso). Para produção mais séria, considere a extensão **Supabase
  Vault**.
- A tabela `leads` cresce indefinidamente — sem faxina automática de leads
  antigos descartados.
- Não tem "esqueci minha senha" na tela de login (só entrar/cadastrar) —
  use o painel do Supabase (Authentication → Users) pra resetar manualmente
  se precisar.
