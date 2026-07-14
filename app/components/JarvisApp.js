'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AREA, defaultSettings } from '@/lib/defaultData';
import { cleanNewsTitle } from '@/lib/rss';
import { pickBestVoice, splitSentences, timeToSpeech, naturalJoin } from '@/lib/voice';
import { dateKeyInTZ } from '@/lib/tz';
import SecondBrainGraph from './SecondBrainGraph';
import SettingsModal from './SettingsModal';
import { AgendaPanel, EmailsPanel, NewsPanel, DigestPanel, ProspectPanel } from './Panels';

const norm = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export default function JarvisApp() {
  const router = useRouter();

  const [phase, setPhase] = useState('boot'); // boot | bootFade | gate | app
  const [settings, setSettings] = useState(null);
  const [orbState, setOrbState] = useState('ocioso');
  const [status, setStatus] = useState('aguardando ativação');
  const [youSaid, setYouSaid] = useState('');
  const [botSaid, setBotSaid] = useState('');
  const [textInput, setTextInput] = useState('');
  const [micOn, setMicOn] = useState(false);
  const [activeTab, setActiveTab] = useState('agenda');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingId, setEditingId] = useState(undefined); // undefined = fechado, null = nota nova, id = editando
  const [flashSignal, setFlashSignal] = useState(null);

  const [agendaEvents, setAgendaEvents] = useState([]);
  const [agendaLoading, setAgendaLoading] = useState(false);
  const [agendaOffline, setAgendaOffline] = useState(false);

  const [emailMessages, setEmailMessages] = useState([]);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailOffline, setEmailOffline] = useState(false);

  const [newsBySubject, setNewsBySubject] = useState({});
  const [newsLoading, setNewsLoading] = useState(false);

  const [digestText, setDigestText] = useState('');
  const [digestLoading, setDigestLoading] = useState(false);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [voicePrefName, setVoicePrefName] = useState('');
  const [leads, setLeads] = useState([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [prospectRunning, setProspectRunning] = useState(false);
  const [prospectMessage, setProspectMessage] = useState('');

  // refs para leitura síncrona dentro de callbacks (evita closures desatualizadas)
  const settingsRef = useRef(null); settingsRef.current = settings;
  const agendaEventsRef = useRef([]); agendaEventsRef.current = agendaEvents;
  const emailMessagesRef = useRef([]); emailMessagesRef.current = emailMessages;
  const newsBySubjectRef = useRef({}); newsBySubjectRef.current = newsBySubject;
  const leadsRef = useRef([]); leadsRef.current = leads;

  const busyRef = useRef(false);
  const awakeRef = useRef(false);
  const awakeTimerRef = useRef(null);
  const micOnRef = useRef(false);
  const recognitionRef = useRef(null);
  const chosenVoiceRef = useRef(null);
  const historyRef = useRef([]);

  const actionCount = emailMessages.filter((m) => m.balde === 'acao').length;

  /* ───────── boot → ativação ───────── */
  useEffect(() => {
    const t = setTimeout(() => setPhase('bootFade'), 2200);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (phase !== 'bootFade') return;
    const t = setTimeout(() => setPhase('gate'), 720);
    return () => clearTimeout(t);
  }, [phase]);

  async function handleActivate() {
    setPhase('app');
    setOrbState('ocioso');

    const res = await fetch('/api/settings');
    const data = await res.json();
    const s = data.settings || defaultSettings();
    setSettings(s);
    settingsRef.current = s;

    loadVoices(s);
    micOnRef.current = true;
    setMicOn(true);
    initRecognition(s);

    refreshAgenda(false);
    refreshEmails();
    refreshNews(false);
    refreshLeads();

    speak('Sistemas online. Estou ouvindo, ' + s.address + '.');

    if (s.lastDigestDate !== dateKeyInTZ(new Date(), s.timezone)) {
      setTimeout(() => runDigest('auto'), 5000);
    }
  }

  /* ───────── voz: TTS ───────── */
  function loadVoices(s) {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const saved = localStorage.getItem('jarvis_voice_pref') || '';
    setVoicePrefName(saved);
    const pick = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return;
      const ptVoices = voices.filter((v) => (v.lang || '').toLowerCase().startsWith('pt'));
      setAvailableVoices(ptVoices.length ? ptVoices : voices);
      chosenVoiceRef.current = pickBestVoice(voices, s.voiceGender || 'masculina', saved);
    };
    pick();
    window.speechSynthesis.onvoiceschanged = pick;
  }

  function setVoicePreference(name) {
    localStorage.setItem('jarvis_voice_pref', name || '');
    setVoicePrefName(name || '');
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const voices = window.speechSynthesis.getVoices();
    chosenVoiceRef.current = pickBestVoice(voices, (settingsRef.current || {}).voiceGender, name);
  }

  function previewVoice(name) {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const voices = window.speechSynthesis.getVoices();
    const v = voices.find((x) => x.name === name);
    const u = new window.SpeechSynthesisUtterance('Boa tarde. É assim que minha voz vai soar a partir de agora.');
    u.lang = 'pt-BR';
    if (v) u.voice = v;
    u.rate = 0.98;
    u.pitch = 1.0;
    try { window.speechSynthesis.cancel(); } catch (e) {}
    window.speechSynthesis.speak(u);
  }

  function speak(text) {
    if (!text || typeof window === 'undefined' || !window.speechSynthesis) { busyRef.current = false; return; }
    busyRef.current = true;
    try { window.speechSynthesis.cancel(); } catch (e) {}

    const sentences = splitSentences(text);
    sentences.forEach((sentence, i) => {
      const u = new window.SpeechSynthesisUtterance(sentence);
      u.lang = 'pt-BR';
      if (chosenVoiceRef.current) u.voice = chosenVoiceRef.current;
      // leve variação natural de ritmo/tom entre frases — evita a cadência de robô lendo um script
      u.rate = 0.95 + Math.random() * 0.08;
      u.pitch = 0.97 + Math.random() * 0.06;
      if (i === 0) {
        u.onstart = () => { setOrbState('falando'); setStatus('falando...'); };
      }
      if (i === sentences.length - 1) {
        u.onend = () => { busyRef.current = false; setOrbState('ocioso'); setStatus('aguardando comando'); startRecognition(); };
        u.onerror = () => { busyRef.current = false; setOrbState('ocioso'); startRecognition(); };
      }
      window.speechSynthesis.speak(u);
    });
  }

  function stopSpeaking() {
    try { window.speechSynthesis.cancel(); } catch (e) {}
    busyRef.current = false;
    setOrbState('ocioso');
    setStatus('fala interrompida');
    startRecognition();
  }

  /* ───────── voz: STT ───────── */
  function initRecognition(s) {
    if (typeof window === 'undefined') return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setStatus('reconhecimento de voz não suportado neste navegador — use o campo de texto'); return; }
    const recognition = new SR();
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (ev) => {
      if (busyRef.current) return;
      const last = ev.results[ev.results.length - 1];
      if (!last.isFinal) return;
      const said = last[0].transcript.trim();
      if (said) handleSpeech(said, s);
    };
    recognition.onerror = (ev) => {
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
        micOnRef.current = false;
        setMicOn(false);
        setStatus('permissão do microfone negada — libere o microfone ou use o campo de texto');
      }
    };
    recognition.onend = () => { if (micOnRef.current && !busyRef.current) startRecognition(); };

    recognitionRef.current = recognition;
    startRecognition();
  }

  function startRecognition() {
    const r = recognitionRef.current;
    const s = settingsRef.current;
    if (!r || !micOnRef.current || busyRef.current) return;
    try { r.start(); } catch (e) { /* "already started" — ignora */ }
    setOrbState('ouvindo');
    if (!busyRef.current) setStatus(awakeRef.current ? 'ouvindo... diga seu comando' : `diga "${s ? s.wakeWord : 'ei jarvis'}" para me acionar`);
  }

  function toggleMic() {
    micOnRef.current = !micOnRef.current;
    setMicOn(micOnRef.current);
    if (micOnRef.current) { startRecognition(); setStatus('microfone ativo'); }
    else { try { recognitionRef.current && recognitionRef.current.stop(); } catch (e) {} setOrbState('ocioso'); setStatus('microfone pausado'); }
  }

  function resetAwake() {
    clearTimeout(awakeTimerRef.current);
    awakeTimerRef.current = setTimeout(() => { awakeRef.current = false; }, 15000);
  }

  function handleSpeech(said, s) {
    const wakeWord = (s || settingsRef.current || {}).wakeWord || 'ei jarvis';
    const n = norm(said);
    const wake = norm(wakeWord);
    if (!awakeRef.current) {
      const idx = n.indexOf(wake);
      if (idx === -1) return;
      const after = said.slice(idx + wakeWord.length).replace(/^[\s,.:;!?]+/, '').trim();
      if (after.length > 2) routeCommand(after);
      else { awakeRef.current = true; resetAwake(); speak('Sim, ' + (s || settingsRef.current).address + '?'); }
    } else {
      awakeRef.current = false;
      clearTimeout(awakeTimerRef.current);
      routeCommand(said);
    }
  }

  function speakLocal(text) { setBotSaid(text); speak(text); }

  function showPanel(name) { setActiveTab(name); }

  /* ───────── roteador de comandos locais ───────── */
  function routeCommand(text) {
    setYouSaid(text);
    if (tryLocalCommand(text)) return;
    askChat(text);
  }

  function tryLocalCommand(text) {
    const n = norm(text);
    const events = agendaEventsRef.current;
    const emails = emailMessagesRef.current;
    const news = newsBySubjectRef.current;

    if (n.includes('lead')) {
      showPanel('prospect');
      const leadsAtuais = leadsRef.current.filter((l) => l.status === 'novo');
      if (!leadsAtuais.length) { speakLocal('Nenhum lead novo no momento.'); return true; }
      const top = leadsAtuais.slice(0, 5).map((l) => l.nome + ', telefone ' + l.telefone);
      speakLocal(`Você tem ${leadsAtuais.length} leads novos. Os principais: ` + naturalJoin(top) + '.');
      return true;
    }
    if (n.includes('bom dia')) { showPanel('digest'); runDigest('voz'); return true; }
    if (n.includes('atualizar') && n.includes('mail')) { refreshEmails(); speakLocal('Atualizando seus e-mails.'); return true; }
    if (n.includes('atualizar') && n.includes('noticia')) { refreshNews(true); speakLocal('Atualizando as notícias.'); return true; }

    const newsSubjMatch = n.match(/noticias? de (.+)/);
    if (newsSubjMatch) {
      const subj = newsSubjMatch[1].trim();
      showPanel('news');
      const keys = Object.keys(news);
      const found = keys.find((k) => norm(k) === subj) || keys.find((k) => norm(k).includes(subj) || subj.includes(norm(k)));
      if (found) speakLocal('Manchetes de ' + found + ': ' + news[found].slice(0, 5).map((it) => cleanNewsTitle(it.title)).join('. '));
      else speakLocal('Ainda não tenho ' + subj + ' no radar de notícias. Adicione esse assunto em configurações.');
      return true;
    }
    if (n.includes('noticia')) {
      showPanel('news');
      const all = [];
      Object.keys(news).forEach((subj) => (news[subj] || []).slice(0, 3).forEach((it) => all.push(subj + ': ' + cleanNewsTitle(it.title))));
      speakLocal(all.length ? 'Principais manchetes: ' + all.slice(0, 6).join('. ') : 'Nenhuma notícia carregada ainda.');
      return true;
    }
    if (n.includes('mail') && n.includes('importante')) {
      showPanel('emails');
      const resumos = emails.filter((m) => m.balde === 'acao').slice(0, 5).map((m) => m.resumo).filter(Boolean);
      speakLocal(resumos.length ? 'Sim: ' + resumos.join(' ') : 'Nenhum e-mail pedindo ação no momento.');
      return true;
    }
    if (n.includes('meus') && n.includes('mail')) {
      showPanel('emails');
      const acao = emails.filter((m) => m.balde === 'acao').length;
      const info = emails.filter((m) => m.balde === 'info').length;
      const ruido = emails.filter((m) => m.balde === 'ruido').length;
      let fala = `Você tem ${acao} e-mails pedindo ação, ${info} informativos e ${ruido} de ruído.`;
      if (acao) fala += ' ' + emails.filter((m) => m.balde === 'acao').slice(0, 3).map((m) => m.resumo).filter(Boolean).join(' ');
      speakLocal(fala);
      return true;
    }
    if (n.includes('agenda da semana') || n.includes('agenda desta semana')) {
      showPanel('agenda');
      const now = new Date();
      const upcoming = events.filter((e) => new Date(e.start) > now).slice(0, 8);
      speakLocal(upcoming.length ? 'Nos próximos dias: ' + naturalJoin(upcoming.map((e) => e.summary)) + '.' : 'Sua agenda está livre nos próximos dias.');
      return true;
    }
    if (n.includes('proximo compromisso') || n.includes('proxima reuniao')) {
      showPanel('agenda');
      const now = new Date();
      const next = events.find((e) => new Date(e.start) > now);
      if (!next) { speakLocal('Não encontrei nenhum compromisso futuro na sua agenda.'); return true; }
      const mins = Math.round((new Date(next.start) - now) / 60000);
      const cd = mins < 60 ? mins + ' minutos' : Math.floor(mins / 60) + ' horas e ' + (mins % 60) + ' minutos';
      speakLocal('Seu próximo compromisso é ' + next.summary + ', em ' + cd + '.');
      return true;
    }
    if (n.includes('minha agenda') || n.includes('o que eu tenho hoje') || n.includes('agenda de hoje')) {
      showPanel('agenda');
      const now = new Date();
      const today = events.filter((e) => new Date(e.start).toDateString() === now.toDateString());
      speakLocal(
        today.length
          ? 'Hoje você tem: ' + naturalJoin(today.map((e) => {
              const t = e.allDay ? 'dia todo' : timeToSpeech(new Date(e.start));
              return t + ' ' + e.summary;
            })) + '.'
          : 'Você não tem nada agendado para hoje.'
      );
      return true;
    }
    return false;
  }

  /* ───────── chat (Groq via /api/chat) ───────── */
  async function askChat(message) {
    busyRef.current = true;
    setOrbState('pensando');
    setStatus('processando...');
    historyRef.current.push({ role: 'user', content: message });
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history: historyRef.current.slice(-16) })
      });
      const data = await res.json();
      const reply = data.reply || 'Não consegui responder agora.';
      historyRef.current.push({ role: 'assistant', content: reply });
      setBotSaid(reply);
      speak(reply);
      if (data.notesChanged) {
        const r2 = await fetch('/api/settings');
        const d2 = await r2.json();
        if (d2.settings) { setSettings(d2.settings); settingsRef.current = d2.settings; }
        if (data.changedIds && data.changedIds.length) {
          setFlashSignal({ id: data.changedIds[0], key: Date.now() });
        }
      }
    } catch (e) {
      busyRef.current = false;
      speak('Não consegui me conectar à internet. Verifique sua conexão.');
    }
  }

  /* ───────── agenda / e-mails / notícias / digest ───────── */
  async function refreshAgenda(force) {
    setAgendaLoading(true);
    setAgendaOffline(false);
    try {
      const res = await fetch('/api/agenda' + (force ? '?force=1' : ''));
      const data = await res.json();
      if (data.error) setAgendaOffline(true);
      else setAgendaEvents(data.events || []);
    } catch (e) {
      setAgendaOffline(true);
    }
    setAgendaLoading(false);
  }

  async function refreshEmails() {
    setEmailLoading(true);
    setEmailOffline(false);
    const s = settingsRef.current;
    const configured = ((s && s.emailAccounts) || []).filter((a) => a.email && a.senhaApp);
    if (!configured.length) { setEmailMessages([]); setEmailLoading(false); return; }

    try {
      let all = [];
      for (const acc of configured) {
        const res = await fetch('/api/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId: acc.id, quantidade: 20 })
        });
        const data = await res.json();
        if (data.error) continue;
        all = all.concat(data.emails || []);
      }
      if (all.length) {
        const triageRes = await fetch('/api/emails/triage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emails: all.map((m) => ({ id: m.id, de: m.de, assunto: m.assunto, trecho: m.trecho })) })
        });
        const triageData = await triageRes.json();
        const map = triageData.triage || {};
        all = all.map((m) => ({ ...m, balde: (map[m.id] || {}).balde || 'info', resumo: (map[m.id] || {}).resumo || '' }));
      }
      setEmailMessages(all);
    } catch (e) {
      setEmailOffline(true);
    }
    setEmailLoading(false);
  }

  async function refreshNews(force) {
    setNewsLoading(true);
    try {
      const res = await fetch('/api/news' + (force ? '?force=1' : ''));
      const data = await res.json();
      setNewsBySubject(data.bySubject || {});
    } catch (e) {}
    setNewsLoading(false);
  }

  async function runDigest(trigger) {
    setActiveTab('digest');
    setDigestLoading(true);
    try {
      const res = await fetch('/api/digest', { method: 'POST' });
      const data = await res.json();
      const text = data.text || 'Não consegui montar seu briefing agora.';
      setDigestText(text);
      speak(text);
      const s = settingsRef.current;
      if (s) { const ns = { ...s, lastDigestDate: dateKeyInTZ(new Date(), s.timezone) }; setSettings(ns); settingsRef.current = ns; }
    } catch (e) {
      setDigestText('Não consegui montar seu briefing agora.');
    }
    setDigestLoading(false);
  }

  async function refreshLeads() {
    setLeadsLoading(true);
    try {
      const res = await fetch('/api/prospect/leads?limit=100');
      const data = await res.json();
      setLeads(data.leads || []);
    } catch (e) {}
    setLeadsLoading(false);
  }

  async function runProspectNow() {
    setProspectRunning(true);
    setProspectMessage('Buscando negócios e qualificando com a Groq — pode levar até um minuto...');
    try {
      const res = await fetch('/api/prospect/run-now', { method: 'POST' });
      const data = await res.json();
      if (data.skipped) {
        setProspectMessage('Não rodou: ' + data.reason + '.');
      } else if (data.error) {
        setProspectMessage('Erro: ' + data.error);
      } else {
        setProspectMessage(`Encontrados ${data.found}, novos ${data.novos}, qualificados ${data.qualificados}.`);
        await refreshLeads();
      }
    } catch (e) {
      setProspectMessage('Não consegui rodar a busca agora.');
    }
    setProspectRunning(false);
  }

  async function setLeadStatus(id, status) {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    try {
      await fetch('/api/prospect/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status })
      });
    } catch (e) {}
  }

  /* ───────── entrada por texto ───────── */
  function handleTextSubmit(e) {
    e.preventDefault();
    const t = textInput.trim();
    if (!t) return;
    setTextInput('');
    routeCommand(t);
  }

  /* ───────── settings: persistência ───────── */
  async function persistSettings(next) {
    setSettings(next);
    settingsRef.current = next;
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: next })
      });
    } catch (e) {}
  }
  function updateSettings(patch) {
    persistSettings({ ...settingsRef.current, ...patch });
  }

  /* ───────── editor de notas ───────── */
  function openEditor(id) { setEditingId(id); }
  function closeEditor() { setEditingId(undefined); }
  function saveNote(form) {
    const notes = [...(settings.notes || [])];
    if (editingId) {
      const idx = notes.findIndex((n) => n.id === editingId);
      if (idx > -1) notes[idx] = { ...notes[idx], title: form.title, area: form.area, body: form.body };
    } else {
      notes.push({ id: 'n' + Date.now() + Math.floor(Math.random() * 999), title: form.title, area: form.area, body: form.body });
    }
    updateSettings({ notes });
    closeEditor();
  }
  function deleteNote() {
    if (!editingId) return;
    updateSettings({ notes: (settings.notes || []).filter((n) => n.id !== editingId) });
    closeEditor();
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  /* ═══════════════════ RENDER ═══════════════════ */
  const name = settings ? settings.name : 'JARVIS';

  return (
    <>
      <div id="boot" className={phase === 'bootFade' ? 'fade' : ''} style={{ display: phase === 'gate' || phase === 'app' ? 'none' : undefined }}>
        <div className="bigname">{name.toUpperCase()}</div>
        <hr className="boot-hr" />
        <div className="sync mono">SINCRONIZANDO DADOS...</div>
        <div className="ver mono">v6.0 · NEXT</div>
      </div>

      <div id="gate" className={phase === 'gate' ? 'show' : ''} style={{ display: phase === 'app' ? 'none' : undefined }}>
        <div className="bigname">{name.toUpperCase()}</div>
        <button id="btnActivate" onClick={handleActivate}>► ATIVAR SISTEMA</button>
        <div className="hint mono">CLIQUE PARA INICIAR</div>
      </div>

      {phase === 'app' && settings && (
        <div id="app" className="show">
          <header>
            <div className="logo">{name.toUpperCase()}</div>
            <div className="spacer" />
            {actionCount > 0 && <span className="badge" title="E-mails pedindo ação">{actionCount}</span>}
            <button className="btn" onClick={() => setSettingsOpen(true)}>⚙</button>
            <button className="btn" onClick={handleLogout}>Sair</button>
          </header>

          <div id="stage">
            <div id="orbWrap" className={orbState !== 'ocioso' ? orbState : ''} onClick={() => { micOnRef.current = true; setMicOn(true); awakeRef.current = true; resetAwake(); startRecognition(); setStatus('ouvindo... diga seu comando'); }}>
              <div className="ring" /><div className="ring r2" /><div className="ring r3" />
              <div id="orb" />
            </div>
            <div id="assistName" className="mono">{name.toUpperCase()}</div>
            <div id="status">{status}</div>
            <div className="convo" id="youSaid">{youSaid && <>Você: <b>{youSaid}</b></>}</div>
            <div className="convo" id="botSaid">{botSaid}</div>
            <form id="controls" onSubmit={handleTextSubmit}>
              <input id="textIn" type="text" placeholder="ou digite e tecle Enter" value={textInput} onChange={(e) => setTextInput(e.target.value)} />
              <button type="button" className="btn accent" onClick={toggleMic}>🎤 {micOn ? 'Mic' : 'Mic off'}</button>
              <button type="button" className="btn danger" onClick={stopSpeaking}>■ Parar</button>
            </form>
          </div>

          <section id="brainSec">
            <div id="brainBar">
              <span className="title">🧠 SECOND BRAIN</span>
              <span className="sub">memória viva · contexto pessoal</span>
              <div className="spacer" />
              <span id="brainCount">{(settings.notes || []).length} notas · {new Set((settings.notes || []).map((n) => n.area)).size} áreas</span>
              <button className="btn accent" onClick={() => openEditor(null)}>+</button>
            </div>
            <SecondBrainGraph notes={settings.notes || []} edges={settings.edges || []} onNodeClick={openEditor} flashSignal={flashSignal} />
          </section>

          <nav id="tabbar">
            <button className={'tabbtn' + (activeTab === 'agenda' ? ' active' : '')} onClick={() => setActiveTab('agenda')}>📅 AGENDA</button>
            <button className={'tabbtn' + (activeTab === 'emails' ? ' active' : '')} onClick={() => setActiveTab('emails')}>✉ E-MAILS</button>
            <button className={'tabbtn' + (activeTab === 'news' ? ' active' : '')} onClick={() => setActiveTab('news')}>📰 NOTÍCIAS</button>
            <button className={'tabbtn' + (activeTab === 'digest' ? ' active' : '')} onClick={() => setActiveTab('digest')}>☀ DIGEST</button>
            <button className={'tabbtn' + (activeTab === 'prospect' ? ' active' : '')} onClick={() => setActiveTab('prospect')}>🎯 PROSPECÇÃO</button>
          </nav>

          {activeTab === 'agenda' && (
            <section className="panel">
              <div className="panelBar">
                <span className="ptitle">📅 Central de Agenda</span>
                <span className="psub">hoje + próximos 7 dias</span>
                <div className="spacer" />
                <button className="btn" onClick={() => refreshAgenda(true)}>↻</button>
              </div>
              <div className="panelBody"><AgendaPanel events={agendaEvents} loading={agendaLoading} offline={agendaOffline} /></div>
            </section>
          )}

          {activeTab === 'emails' && (
            <section className="panel">
              <div className="panelBar">
                <span className="ptitle">✉ Central de E-mails</span>
                <span className="psub">{(settings.emailAccounts || []).filter((a) => a.email).length} conta(s) configurada(s)</span>
                <div className="spacer" />
                <button className="btn" onClick={refreshEmails}>↻</button>
              </div>
              <div className="panelBody"><EmailsPanel emails={emailMessages} loading={emailLoading} offline={emailOffline} /></div>
            </section>
          )}

          {activeTab === 'news' && (
            <section className="panel">
              <div className="panelBar">
                <span className="ptitle">📰 Radar de Notícias</span>
                <span className="psub">Brasil · português</span>
                <div className="spacer" />
                <button className="btn" onClick={() => refreshNews(true)}>↻</button>
              </div>
              <div className="panelBody"><NewsPanel bySubject={newsBySubject} loading={newsLoading} /></div>
            </section>
          )}

          {activeTab === 'digest' && (
            <section className="panel">
              <div className="panelBar">
                <span className="ptitle">☀ Morning Digest</span>
                <span className="psub">seu briefing falado do dia</span>
                <div className="spacer" />
                <button className="btn accent" onClick={() => runDigest('botao')}>Bom dia</button>
              </div>
              <div className="panelBody"><DigestPanel text={digestText} loading={digestLoading} /></div>
            </section>
          )}

          {activeTab === 'prospect' && (
            <section className="panel">
              <div className="panelBar">
                <span className="ptitle">🎯 Prospecção de Clientes</span>
                <span className="psub">{leads.filter((l) => l.status === 'novo').length} novo(s)</span>
                <div className="spacer" />
                <button className="btn" onClick={refreshLeads}>↻</button>
                <button className="btn accent" onClick={runProspectNow} disabled={prospectRunning}>
                  {prospectRunning ? 'Buscando...' : '🔍 Buscar agora'}
                </button>
              </div>
              <div className="panelBody"><ProspectPanel leads={leads} loading={leadsLoading} onSetStatus={setLeadStatus} /></div>
            </section>
          )}
        </div>
      )}

      {settingsOpen && settings && (
        <SettingsModal
          settings={settings}
          onUpdate={updateSettings}
          onClose={() => setSettingsOpen(false)}
          availableVoices={availableVoices}
          voicePrefName={voicePrefName}
          onSetVoicePreference={setVoicePreference}
          onPreviewVoice={previewVoice}
          onRunProspectNow={runProspectNow}
          prospectRunning={prospectRunning}
          prospectMessage={prospectMessage}
        />
      )}

      {editingId !== undefined && settings && (
        <NoteEditor
          note={editingId ? (settings.notes || []).find((n) => n.id === editingId) : null}
          onSave={saveNote}
          onDelete={editingId ? deleteNote : null}
          onCancel={closeEditor}
        />
      )}
    </>
  );
}

function NoteEditor({ note, onSave, onDelete, onCancel }) {
  const [title, setTitle] = useState(note ? note.title : '');
  const [area, setArea] = useState(note ? note.area : 'meta');
  const [body, setBody] = useState(note ? note.body : '');

  return (
    <div id="overlay" className="show" onClick={(e) => { if (e.target.id === 'overlay') onCancel(); }}>
      <div id="editor">
        <h3>{note ? 'EDITAR NOTA' : 'NOVA NOTA'}</h3>
        <div>
          <label>Título</label>
          <input value={title} maxLength={40} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label>Área</label>
          <select value={area} onChange={(e) => setArea(e.target.value)}>
            {Object.keys(AREA).map((a) => <option key={a} value={a}>{AREA[a].label}</option>)}
          </select>
        </div>
        <div>
          <label>Conteúdo</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <div className="row">
          {onDelete && <button className="btn danger" onClick={onDelete}>Excluir</button>}
          <button className="btn" onClick={onCancel}>Cancelar</button>
          <button className="btn accent" onClick={() => onSave({ title: title.trim() || 'Nota', area, body: body.trim() })}>Salvar</button>
        </div>
      </div>
    </div>
  );
}
