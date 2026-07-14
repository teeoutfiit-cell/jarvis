# JARVIS — Next.js + Supabase + Groq

Migração da versão em arquivo único (HTML + antena local) para um app de verdade:
**Next.js 16 (App Router) · Supabase (Auth + Postgres) · Groq · deploy na Vercel**.

Tudo que antes vivia no `localStorage` do seu navegador agora fica no Supabase,
protegido por login — dá pra acessar de qualquer aparelho com sua conta.

## Stack

- **Next.js 16** (App Router, Route Handlers em Node.js runtime)
- **Supabase**: Auth (email/senha) + Postgres (RLS por usuário)
- **Groq**: motor de IA (chat, triagem de e-mails, digest)
- **Vercel**: hospedagem
- Zero frameworks de CSS — o mesmo tema dark sci-fi de sempre, em CSS puro

## 1. Criar o projeto no Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Vá em **SQL Editor** → cole o conteúdo de `supabase/schema.sql` → **Run**.
   Isso cria as tabelas `app_settings` e `email_triage`, com RLS habilitada
   (cada usuário só vê os próprios dados).
3. Vá em **Settings → API** e copie:
   - **Project URL**
   - **anon / publishable key**

## 2. Configurar variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

```
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sua-chave-anon
```

**Não existe variável de ambiente para a chave da Groq.** Cada usuário loga e
cola a própria chave em **⚙ → Motor**, que fica salva no Supabase (tabela
`app_settings`), protegida por RLS.

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

## 4. Primeira configuração dentro do app

Depois de logado, clique em **► ATIVAR SISTEMA** → permita o microfone →
clique em **⚙**:

- **Motor**: cole sua API key da Groq (console.groq.com/keys) e escolha o
  nível (ECONÔMICO / EQUILIBRADO / MÁXIMO).
- **Agenda**: cole o link secreto iCal de cada agenda Google (Google Agenda
  no computador → ⚙ Configurações → clique na agenda à esquerda → "Integrar
  agenda" → copie o "Endereço secreto em formato iCal").
- **E-mails**: (a) ative a verificação em 2 etapas em
  myaccount.google.com/security → (b) crie uma senha de app em
  myaccount.google.com/apppasswords chamada "Jarvis" → (c) cole a senha de
  16 letras.
- **Notícias**: assuntos do radar (um por linha).
- **Digest**: cidade para a previsão do tempo.

Diga **"Ei Jarvis, bom dia"** para testar o Morning Digest completo.

## 5. Subir para o GitHub

```bash
git init
git add .
git commit -m "jarvis: primeira versão next+supabase"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/jarvis.git
git push -u origin main
```

## 6. Deploy na Vercel

1. Importe o repositório em [vercel.com/new](https://vercel.com/new).
2. Nas **Environment Variables**, adicione as mesmas duas do `.env.local`
   (`NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`).
3. Deploy.
4. No Supabase, vá em **Authentication → URL Configuration** e adicione a
   URL da Vercel (`https://seu-projeto.vercel.app`) em **Site URL** e
   **Redirect URLs** (com `/auth/callback` no final), senão o link de
   confirmação de e-mail redireciona para o lugar errado.

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
  ICS / RSS diretamente no servidor — não precisam mais de allowlist de
  proxy, porque não aceitam mais uma URL arbitrária vinda do cliente: eles
  só buscam as URLs que já estão salvas nas configurações do próprio usuário
  autenticado.
- Grafo neural do Second Brain: antes era SVG injetado via `innerHTML` numa
  `<div>` (truque necessário pra evitar bug de namespace SVG no Safari, já
  que era HTML puro). Em React isso não é mais necessário — o componente
  `SecondBrainGraph.js` retorna `<svg>` como JSX de verdade.
- Autenticação: `@supabase/ssr` com `getAll`/`setAll` (padrão atual —
  `get`/`set`/`remove` está deprecado). No Next.js 16 o arquivo de
  middleware foi renomeado de `middleware.ts` para **`proxy.js`**
  (exportando `async function proxy(request)`), que é o que este projeto
  usa.

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
- "Ei Jarvis, bom dia" (Morning Digest)
- "Ei Jarvis, atualizar e-mails" / "atualizar notícias"

## Limitações conhecidas (mesmas da Parte 2, herdadas)

- Parser ICS trata `TZID` como o fuso do servidor (aproximação razoável para
  uso pessoal de uma pessoa só).
- RRULE expande DAILY/WEEKLY/MONTHLY/YEARLY com BYDAY/COUNT/UNTIL/EXDATE
  básicos — casos exóticos (ex. BYMONTHDAY) não quebram o app, só não expandem.
- Extração de corpo de e-mail multipart é best-effort via regex, não um
  parser MIME completo — suficiente para os ~500 caracteres de trecho usados
  na triagem.
- Senha de app do Gmail fica em texto plano na tabela `email_accounts`
  (dentro do jsonb `app_settings`, protegida por RLS). Para produção mais
  séria, considere usar a extensão **Supabase Vault** para criptografar esse
  campo em repouso.
