'use client';

import { useState } from 'react';
import { isSameDay, dayLabel, relTime } from '@/lib/format';
import { cleanNewsTitle, newsSource } from '@/lib/rss';

function EventRow({ e }) {
  const d = new Date(e.start);
  const time = e.allDay ? 'DIA TODO' : String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  return (
    <div className="evRow">
      <span className="dot" style={{ background: e.color }} />
      <span className="evTime mono">{time}</span>
      <span className="evTitle">{e.summary}</span>
    </div>
  );
}

export function AgendaPanel({ events, loading, offline }) {
  if (offline) return <div className="emptyHint">ANTENA OFFLINE — verifique as variáveis de ambiente do Supabase</div>;
  if (loading) return <div className="emptyHint">Carregando agenda...</div>;
  if (!events || !events.length) return <div className="emptyHint">Nenhum evento nos próximos 8 dias. Configure suas agendas em ⚙.</div>;

  const now = new Date();
  const today = events.filter((e) => isSameDay(e.start, now));
  const next = events.find((e) => new Date(e.start) > now);

  const byDay = {};
  events
    .filter((e) => !isSameDay(e.start, now) && new Date(e.start) > now)
    .forEach((e) => {
      const key = new Date(e.start).toDateString();
      (byDay[key] = byDay[key] || []).push(e);
    });

  return (
    <div>
      {next && (() => {
        const mins = Math.round((new Date(next.start) - now) / 60000);
        const cd = mins < 60 ? mins + 'min' : Math.floor(mins / 60) + 'h ' + (mins % 60) + 'min';
        return (
          <div className="nextEvent">
            <span className="dot" style={{ background: next.color }} /> PRÓXIMO: <b>{next.summary}</b> em {cd}
          </div>
        );
      })()}

      <div className="dayGroup">
        <div className="dayLabel">HOJE</div>
        {today.length ? today.map((e, i) => <EventRow key={i} e={e} />) : <div className="emptyHint small">Nada agendado hoje.</div>}
      </div>

      {Object.keys(byDay).map((key) => (
        <div className="dayGroup" key={key}>
          <div className="dayLabel">{dayLabel(key)}</div>
          {byDay[key].map((e, i) => <EventRow key={i} e={e} />)}
        </div>
      ))}
    </div>
  );
}

export function EmailsPanel({ emails, loading, offline }) {
  const [expanded, setExpanded] = useState({});
  if (offline) return <div className="emptyHint">ANTENA OFFLINE — verifique as variáveis de ambiente do Supabase</div>;
  if (loading) return <div className="emptyHint">Buscando e-mails...</div>;
  if (!emails || !emails.length) return <div className="emptyHint">Configure suas contas em ⚙.</div>;

  const buckets = { acao: [], info: [], ruido: [] };
  emails.forEach((m) => buckets[m.balde || 'info'].push(m));

  const Section = ({ label, items }) => {
    if (!items.length) return null;
    return (
      <div className="emailSection">
        <div className="emailSecLabel">{label} ({items.length})</div>
        {items.map((m) => (
          <div
            key={m.id}
            className={'emailRow' + (expanded[m.id] ? ' expanded' : '')}
            onClick={() => setExpanded((prev) => ({ ...prev, [m.id]: !prev[m.id] }))}
          >
            <span className="dot" style={{ background: m.contaColor }} />
            <div className="emailMain">
              <div className="emailFrom">
                {m.de} · {m.assunto} <span className="evTime mono">{relTime(m.data)}</span>
              </div>
              <div className="emailResumo">{m.resumo}</div>
              <div className="emailSnippet">{(m.trecho || '').slice(0, 300)}</div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div>
      <Section label="⚡ AÇÃO" items={buckets.acao} />
      <Section label="INFO" items={buckets.info} />
      <Section label="RUÍDO" items={buckets.ruido} />
    </div>
  );
}

export function NewsPanel({ bySubject, loading }) {
  if (loading) return <div className="emptyHint">Buscando notícias...</div>;
  const subjects = Object.keys(bySubject || {});
  if (!subjects.length) return <div className="emptyHint">Nenhuma notícia encontrada. Configure os assuntos em ⚙.</div>;

  return (
    <div>
      {subjects.map((subj) => (
        <div className="newsSection" key={subj}>
          <div className="newsSecLabel">{subj.toUpperCase()}</div>
          {(bySubject[subj] || []).map((it, i) => {
            const src = newsSource(it.title);
            return (
              <a key={i} className="newsRow" href={it.link} target="_blank" rel="noopener noreferrer">
                {cleanNewsTitle(it.title)} <span className="evTime mono">{src}{src && it.pub ? ' · ' : ''}{relTime(it.pub)}</span>
              </a>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function DigestPanel({ text, loading }) {
  if (loading) return <div className="emptyHint">Montando seu briefing...</div>;
  if (!text) return <div className="emptyHint">Clique em "Bom dia" ou diga a wake word + "bom dia".</div>;
  return <div className="digestText">{text.split('\n').map((line, i) => <p key={i}>{line}</p>)}</div>;
}
