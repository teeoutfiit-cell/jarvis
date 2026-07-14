'use client';

import { useState } from 'react';
import { MODEL_TIERS } from '@/lib/defaultData';

const THEME_COLORS = ['#2dd4ff', '#8b7cff', '#f7931a', '#10b981', '#ec4899'];

export default function SettingsModal({ settings, onUpdate, onClose, availableVoices, voicePrefName, onSetVoicePreference, onPreviewVoice, onRunProspectNow, prospectRunning, prospectMessage }) {
  const [tab, setTab] = useState('agenda');
  const [newsSubjectsText, setNewsSubjectsText] = useState((settings.newsConfig?.subjects || []).join('\n'));
  const [newsCount, setNewsCount] = useState(settings.newsConfig?.count || 5);
  const [weatherCity, setWeatherCity] = useState(settings.weather?.city || '');
  const [groqKey, setGroqKey] = useState(settings.groqApiKey || '');
  const [prospectGoogleKey, setProspectGoogleKey] = useState(settings.prospecting?.googleApiKey || '');
  const [prospectNiches, setProspectNiches] = useState((settings.prospecting?.niches || []).join('\n'));
  const [prospectCities, setProspectCities] = useState((settings.prospecting?.cities || []).join('\n'));
  const [prospectCriteria, setProspectCriteria] = useState(settings.prospecting?.criteria || '');
  const [prospectMinLeads, setProspectMinLeads] = useState(settings.prospecting?.minLeadsPerDay || 10);

  const calendars = settings.calendars || [];
  const emailAccounts = settings.emailAccounts || [];

  function updateCalendar(idx, patch) {
    const next = calendars.map((c, i) => (i === idx ? { ...c, ...patch } : c));
    onUpdate({ calendars: next });
  }
  function addCalendar() {
    const next = [...calendars, { id: 'cal' + Date.now(), name: 'Agenda ' + (calendars.length + 1), color: THEME_COLORS[calendars.length % THEME_COLORS.length], icsUrl: '' }];
    onUpdate({ calendars: next });
  }
  function removeCalendar(idx) {
    onUpdate({ calendars: calendars.filter((_, i) => i !== idx) });
  }

  function updateEmailAccount(idx, patch) {
    const next = emailAccounts.map((a, i) => (i === idx ? { ...a, ...patch } : a));
    onUpdate({ emailAccounts: next });
  }
  function addEmailAccount() {
    const next = [...emailAccounts, { id: 'em' + Date.now(), alias: 'Conta ' + (emailAccounts.length + 1), color: THEME_COLORS[emailAccounts.length % THEME_COLORS.length], host: 'imap.gmail.com', email: '', senhaApp: '' }];
    onUpdate({ emailAccounts: next });
  }
  function removeEmailAccount(idx) {
    onUpdate({ emailAccounts: emailAccounts.filter((_, i) => i !== idx) });
  }

  function saveNews() {
    onUpdate({ newsConfig: { ...settings.newsConfig, subjects: newsSubjectsText.split('\n').map((s) => s.trim()).filter(Boolean), count: parseInt(newsCount, 10) || 5 } });
  }
  function saveWeather() {
    onUpdate({ weather: { city: weatherCity, lat: null, lon: null } });
  }
  function saveGroqKey() {
    onUpdate({ groqApiKey: groqKey.trim() });
  }
  function setTier(tier) {
    onUpdate({ modelTier: tier });
  }
  function saveProspecting() {
    onUpdate({
      prospecting: {
        ...settings.prospecting,
        googleApiKey: prospectGoogleKey.trim(),
        niches: prospectNiches.split('\n').map((s) => s.trim()).filter(Boolean),
        cities: prospectCities.split('\n').map((s) => s.trim()).filter(Boolean),
        criteria: prospectCriteria.trim(),
        minLeadsPerDay: parseInt(prospectMinLeads, 10) || 10
      }
    });
  }
  function toggleProspecting() {
    onUpdate({ prospecting: { ...settings.prospecting, enabled: !settings.prospecting?.enabled } });
  }

  return (
    <div id="settingsOverlay" className="show" onClick={(e) => { if (e.target.id === 'settingsOverlay') onClose(); }}>
      <div id="settingsBox">
        <div className="setHeader">
          <span>⚙ CONFIGURAÇÕES</span>
          <button className="btn" onClick={onClose}>Fechar</button>
        </div>
        <nav id="setTabs">
          {['agenda', 'emails', 'news', 'digest', 'prospect', 'motor', 'voz'].map((t) => (
            <button key={t} className={'setTabBtn' + (tab === t ? ' active' : '')} onClick={() => setTab(t)}>
              {{ agenda: 'Agenda', emails: 'E-mails', news: 'Notícias', digest: 'Digest', prospect: 'Prospecção', motor: 'Motor', voz: 'Voz' }[t]}
            </button>
          ))}
        </nav>

        {tab === 'agenda' && (
          <div className="setPane">
            <p className="setHint">Google Agenda no computador → ⚙ Configurações → clique na agenda à esquerda → "Integrar agenda" → copie o "Endereço secreto em formato iCal".</p>
            <p className="setWarn">Este link dá acesso de leitura à sua agenda. Fica salvo no Supabase, protegido por login, e nunca é enviado à IA.</p>
            {calendars.map((c, idx) => (
              <div className="cfgRow" key={c.id}>
                <input type="text" value={c.name} placeholder="Nome" onChange={(e) => updateCalendar(idx, { name: e.target.value })} />
                <input type="color" value={c.color} onChange={(e) => updateCalendar(idx, { color: e.target.value })} />
                <input type="text" value={c.icsUrl} placeholder="Cole o link secreto iCal" onChange={(e) => updateCalendar(idx, { icsUrl: e.target.value })} />
                <button className="btn danger" onClick={() => removeCalendar(idx)}>×</button>
              </div>
            ))}
            <button className="btn accent" onClick={addCalendar}>+ adicionar agenda</button>
          </div>
        )}

        {tab === 'emails' && (
          <div className="setPane">
            <p className="setHint">
              (a) Ative a verificação em 2 etapas em myaccount.google.com/security → (b) crie uma senha de app em
              myaccount.google.com/apppasswords chamada "Jarvis" → (c) cole a senha de 16 letras aqui.
            </p>
            <p className="setWarn">
              Sua senha de app fica salva no Supabase, protegida por login (RLS). Remetente, assunto e um trecho do
              e-mail são enviados à API da Groq para a triagem. O Jarvis só LÊ: nunca envia, responde, apaga ou marca nada.
            </p>
            {emailAccounts.map((a, idx) => (
              <div className="cfgRow" key={a.id}>
                <input type="text" value={a.alias} placeholder="Apelido" onChange={(e) => updateEmailAccount(idx, { alias: e.target.value })} />
                <input type="color" value={a.color} onChange={(e) => updateEmailAccount(idx, { color: e.target.value })} />
                <input type="text" value={a.host} placeholder="Host IMAP" onChange={(e) => updateEmailAccount(idx, { host: e.target.value })} />
                <input type="text" value={a.email} placeholder="seuemail@gmail.com" onChange={(e) => updateEmailAccount(idx, { email: e.target.value })} />
                <input type="password" value={a.senhaApp} placeholder="Senha de app (16 letras)" onChange={(e) => updateEmailAccount(idx, { senhaApp: e.target.value })} />
                <button className="btn danger" onClick={() => removeEmailAccount(idx)}>×</button>
              </div>
            ))}
            <button className="btn accent" onClick={addEmailAccount}>+ adicionar conta</button>
          </div>
        )}

        {tab === 'news' && (
          <div className="setPane">
            <p className="setHint">Assuntos que o radar acompanha (um por linha).</p>
            <textarea rows={4} value={newsSubjectsText} onChange={(e) => setNewsSubjectsText(e.target.value)} placeholder={'tecnologia\neconomia'} />
            <div className="setRow">
              <label>Manchetes por assunto</label>
              <input type="number" min={1} max={10} value={newsCount} onChange={(e) => setNewsCount(e.target.value)} />
            </div>
            <button className="btn accent" onClick={saveNews}>Salvar</button>
          </div>
        )}

        {tab === 'digest' && (
          <div className="setPane">
            <p className="setHint">Previsão do tempo no digest via Open-Meteo (grátis, sem chave). Informe sua cidade.</p>
            <div className="setRow">
              <label>Cidade</label>
              <input type="text" value={weatherCity} placeholder="ex: São Paulo, BR" onChange={(e) => setWeatherCity(e.target.value)} />
            </div>
            <button className="btn accent" onClick={saveWeather}>Salvar cidade</button>
          </div>
        )}

        {tab === 'prospect' && (
          <div className="setPane">
            <p className="setHint">
              O Jarvis busca negócios locais na Google Places API todo dia de manhã, filtra quem tem telefone e está
              em operação, e qualifica com a Groq usando o critério abaixo + o que ele sabe do seu negócio no Second Brain.
            </p>
            <p className="setWarn">
              A Google Places API é paga por SKU (não é gratuita), mas pro volume daqui (poucas buscas por dia) o custo
              real fica na casa de poucos dólares por mês. Você precisa de uma chave da Places API (New) com billing
              ativado no Google Cloud Console.
            </p>

            <div className="setRow">
              <label>Ativar prospecção diária</label>
              <button className={'tierbtn' + (settings.prospecting?.enabled ? ' active' : '')} onClick={toggleProspecting} style={{ flex: 'none', minWidth: 90 }}>
                {settings.prospecting?.enabled ? 'Ativada' : 'Desativada'}
              </button>
            </div>

            <p className="setHint">Chave da Google Places API (console.cloud.google.com → APIs & Services → Credentials).</p>
            <input type="password" value={prospectGoogleKey} placeholder="Cole sua chave da Google Places API" onChange={(e) => setProspectGoogleKey(e.target.value)} />

            <p className="setHint">Nichos que você quer prospectar (um por linha).</p>
            <textarea rows={3} value={prospectNiches} onChange={(e) => setProspectNiches(e.target.value)} placeholder={'imobiliária\nclínica odontológica'} />

            <p className="setHint">Cidades/regiões alvo (uma por linha).</p>
            <textarea rows={2} value={prospectCities} onChange={(e) => setProspectCities(e.target.value)} placeholder={'São Paulo, SP\nCampinas, SP'} />

            <p className="setHint">Critério de qualificação (em português, livre — a IA usa isso pra pontuar cada lead).</p>
            <textarea rows={3} value={prospectCriteria} onChange={(e) => setProspectCriteria(e.target.value)} />

            <div className="setRow">
              <label>Mínimo de leads/dia (meta)</label>
              <input type="number" min={1} max={50} value={prospectMinLeads} onChange={(e) => setProspectMinLeads(e.target.value)} />
            </div>

            <button className="btn accent" onClick={saveProspecting}>Salvar configuração</button>

            <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
              <button className="btn accent" onClick={onRunProspectNow} disabled={prospectRunning}>
                {prospectRunning ? 'Buscando...' : '🔍 Buscar agora'}
              </button>
              {prospectMessage && <p className="setHint" style={{ marginTop: 8 }}>{prospectMessage}</p>}
            </div>

            <p className="setHint" style={{ marginTop: 10 }}>
              A busca automática roda 1x por dia (via Vercel Cron). Leads já vistos antes não se repetem — só entram
              como "novos" negócios que a busca ainda não tinha encontrado.
            </p>
          </div>
        )}

        {tab === 'motor' && (
          <div className="setPane">
            <p className="setHint">Chave da API da Groq (console.groq.com/keys) — fica salva no Supabase, nunca em variável de ambiente.</p>
            <input id="apiKeyInput" type="password" value={groqKey} placeholder="Cole sua API key da Groq" onChange={(e) => setGroqKey(e.target.value)} />
            <button className="btn accent" onClick={saveGroqKey} style={{ marginBottom: 8 }}>Salvar chave</button>

            <p className="setHint">Nível de cérebro do Jarvis (Groq):</p>
            <div id="motorTiers">
              <button className={'tierbtn' + (settings.modelTier === 'economico' ? ' active' : '')} onClick={() => setTier('economico')}>
                ECONÔMICO<br /><small>{MODEL_TIERS.economico}</small>
              </button>
              <button className={'tierbtn' + (settings.modelTier === 'equilibrado' ? ' active' : '')} onClick={() => setTier('equilibrado')}>
                EQUILIBRADO<br /><small>{MODEL_TIERS.equilibrado}</small>
              </button>
              <button className={'tierbtn' + (settings.modelTier === 'maximo' ? ' active' : '')} onClick={() => setTier('maximo')}>
                MÁXIMO<br /><small>{MODEL_TIERS.maximo}</small>
              </button>
            </div>
            <p className="setHint" style={{ marginTop: 10 }}>
              Modo economia: agenda e notícias em cache nunca gastam tokens extras; e-mails são triados em lote com cache;
              comandos comuns de voz são respondidos localmente.
            </p>
          </div>
        )}

        {tab === 'voz' && (
          <div className="setPane">
            <p className="setHint">
              A voz usa o motor do seu navegador (grátis, sem chave). A qualidade depende do que está instalado no seu
              sistema — vozes com "Natural", "Neural" ou "Online" no nome costumam soar bem menos robóticas. Escolha
              abaixo e clique em testar antes de decidir.
            </p>
            {(!availableVoices || !availableVoices.length) ? (
              <p className="setHint">Nenhuma voz encontrada ainda — abra este painel de novo depois de ativar o sistema.</p>
            ) : (
              <>
                <select
                  value={voicePrefName || ''}
                  onChange={(e) => onSetVoicePreference && onSetVoicePreference(e.target.value)}
                >
                  <option value="">Automático (o Jarvis escolhe a melhor disponível)</option>
                  {availableVoices.map((v) => (
                    <option key={v.name} value={v.name}>{v.name} · {v.lang}</option>
                  ))}
                </select>
                <button
                  className="btn accent"
                  onClick={() => onPreviewVoice && onPreviewVoice(voicePrefName)}
                  style={{ marginTop: 8 }}
                >
                  ▶ Testar voz
                </button>
              </>
            )}
            <p className="setHint" style={{ marginTop: 10 }}>
              Essa escolha fica salva só neste navegador/aparelho (cada dispositivo tem seu próprio conjunto de vozes).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
