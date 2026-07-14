'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg('');
    setLoading(true);
    const supabase = createClient();

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) { setMsg(error.message); return; }
      router.push('/');
      router.refresh();
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin + '/auth/callback' }
      });
      setLoading(false);
      if (error) { setMsg(error.message); return; }
      setMsg('Conta criada. Se a confirmação por e-mail estiver ativa no seu projeto Supabase, confirme antes de entrar.');
    }
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <div style={styles.logo}>JARVIS</div>
        <p style={styles.sub}>{mode === 'signin' ? 'Entrar' : 'Criar conta'}</p>
        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            style={styles.input}
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            style={styles.input}
            type="password"
            placeholder="senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
          <button style={styles.btn} type="submit" disabled={loading}>
            {loading ? 'Aguarde...' : mode === 'signin' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>
        {msg && <p style={styles.msg}>{msg}</p>}
        <button
          style={styles.link}
          onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMsg(''); }}
        >
          {mode === 'signin' ? 'Não tem conta? Criar uma' : 'Já tem conta? Entrar'}
        </button>
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#04070d', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif'
  },
  card: {
    width: 'min(380px, 92vw)', background: '#0a0f1a', border: '1px solid #16233c',
    borderRadius: 14, padding: '32px 28px', textAlign: 'center'
  },
  logo: {
    fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontWeight: 700, fontSize: '1.6rem',
    letterSpacing: '.3em', background: 'linear-gradient(90deg,#2dd4ff,#8b7cff)',
    WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', paddingLeft: '.3em'
  },
  sub: { color: '#8a90a6', fontSize: '.85rem', margin: '10px 0 22px' },
  form: { display: 'flex', flexDirection: 'column', gap: 10 },
  input: {
    background: '#0d1424', border: '1px solid #16233c', borderRadius: 8, color: '#dbe7f5',
    padding: '11px 14px', fontSize: '.9rem'
  },
  btn: {
    background: 'transparent', border: '1px solid #2dd4ff', color: '#2dd4ff', borderRadius: 8,
    padding: '11px 14px', fontSize: '.85rem', letterSpacing: '.1em', cursor: 'pointer', marginTop: 6
  },
  msg: { color: '#fbbf24', fontSize: '.78rem', marginTop: 14, lineHeight: 1.5 },
  link: {
    background: 'none', border: 'none', color: '#8a90a6', fontSize: '.78rem',
    marginTop: 18, cursor: 'pointer', textDecoration: 'underline'
  }
};
