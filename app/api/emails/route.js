import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { loadSettings } from '@/lib/settingsStore';
import { fetchEmailsIMAP, IMAP_ALLOWLIST } from '@/lib/imap';

// Precisa do runtime Node (sockets tls puros) — não funciona no Edge Runtime.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30; // IMAP pode demorar — aumente se sua conta tiver muitos e-mails

export async function POST(req) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || !body.accountId) {
    return NextResponse.json({ error: 'faltou accountId' }, { status: 400 });
  }

  try {
    const settings = await loadSettings(supabase, user.id);
    const acc = (settings.emailAccounts || []).find((a) => a.id === body.accountId);
    if (!acc || !acc.email || !acc.senhaApp) {
      return NextResponse.json({ error: 'conta não configurada' }, { status: 400 });
    }

    const host = (acc.host || 'imap.gmail.com').trim();
    if (!IMAP_ALLOWLIST.has(host)) {
      return NextResponse.json({ error: 'provedor de e-mail não permitido' }, { status: 403 });
    }

    const result = await fetchEmailsIMAP({
      host,
      usuario: acc.email,
      senhaApp: acc.senhaApp,
      quantidade: body.quantidade || 20
    });

    const emails = result.emails.map((m) => ({ ...m, contaId: acc.id, contaAlias: acc.alias, contaColor: acc.color }));
    return NextResponse.json({ emails });
  } catch (e) {
    let msg = 'Não consegui acessar essa caixa de e-mail.';
    if (e.message === 'login_failed') {
      msg = 'Senha de app inválida ou verificação em 2 etapas desativada — refaça em myaccount.google.com/apppasswords';
    }
    return NextResponse.json({ error: msg }, { status: 200 });
  }
}
