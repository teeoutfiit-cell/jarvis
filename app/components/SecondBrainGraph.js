'use client';

import { useEffect, useRef } from 'react';
import { AREA } from '@/lib/defaultData';

const W = 1000, H = 540, CX = W / 2, CY = H / 2 - 10, RX = 380, RY = 195;

export default function SecondBrainGraph({ notes, edges, onNodeClick, flashSignal }) {
  const pulseStateRef = useRef([]);
  const edgeGeomRef = useRef([]);

  const idmap = {};
  notes.forEach((nt) => { idmap[nt.id] = nt; });
  const validEdges = edges.filter((p) => idmap[p[0]] && idmap[p[1]]);

  const deg = {};
  notes.forEach((nt) => { deg[nt.id] = 0; });
  validEdges.forEach((p) => { deg[p[0]]++; deg[p[1]]++; });

  const pos = {};
  notes.forEach((nt, i) => {
    const a = (i / Math.max(notes.length, 1)) * Math.PI * 2 - Math.PI / 2;
    pos[nt.id] = { x: CX + Math.cos(a) * RX, y: CY + Math.sin(a) * RY };
  });

  const notesKey = notes.map((n) => n.id).join(',');
  const edgesKey = validEdges.map((p) => p.join('-')).join(',');

  useEffect(() => {
    const geoms = validEdges.map((pair) => {
      const A = pos[pair[0]], B = pos[pair[1]];
      const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
      const cx = mx + (CX - mx) * 0.35, cy = my + (CY - my) * 0.35;
      return { ax: A.x, ay: A.y, cx, cy, bx: B.x, by: B.y };
    });
    edgeGeomRef.current = geoms;
    pulseStateRef.current = Array.from({ length: 12 }, () => ({
      e: Math.floor(Math.random() * Math.max(geoms.length, 1)),
      t: Math.random(),
      v: 0.003 + Math.random() * 0.006
    }));

    let raf;
    const step = () => {
      const geoms2 = edgeGeomRef.current;
      if (geoms2.length) {
        pulseStateRef.current.forEach((p, i) => {
          p.t += p.v;
          if (p.t >= 1) { p.t = 0; p.e = Math.floor(Math.random() * geoms2.length); p.v = 0.003 + Math.random() * 0.006; }
          const E = geoms2[p.e];
          if (E) {
            const t = p.t, u = 1 - t;
            const x = u * u * E.ax + 2 * u * t * E.cx + t * t * E.bx;
            const y = u * u * E.ay + 2 * u * t * E.cy + t * t * E.by;
            const el = document.getElementById('pulse' + i);
            if (el) {
              el.setAttribute('cx', x.toFixed(1));
              el.setAttribute('cy', y.toFixed(1));
              el.setAttribute('opacity', (Math.sin(t * Math.PI) * 0.95).toFixed(2));
            }
          }
        });
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notesKey, edgesKey]);

  useEffect(() => {
    if (!flashSignal || !flashSignal.id) return;
    const el = document.getElementById('core-' + flashSignal.id);
    if (!el) return;
    let on = true, count = 0;
    const iv = setInterval(() => {
      el.style.opacity = on ? '0.15' : '1';
      on = !on;
      if (++count > 7) { clearInterval(iv); el.style.opacity = '1'; }
    }, 160);
    return () => clearInterval(iv);
  }, [flashSignal]);

  const areasUsed = [...new Set(notes.map((n) => n.area))];

  return (
    <>
      <div id="graphBox">
        <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="coreGrad">
              <stop offset="0%" stopColor="#c4b5fd" />
              <stop offset="55%" stopColor="#8b7cff" />
              <stop offset="100%" stopColor="#4c3fa0" />
            </radialGradient>
            <linearGradient id="edgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8b7cff" />
              <stop offset="100%" stopColor="#2dd4ff" />
            </linearGradient>
            <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="7" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {notes.map((nt) => {
            const p = pos[nt.id];
            const c = (AREA[nt.area] || AREA.meta).color;
            return <line key={'ray-' + nt.id} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke={c} strokeWidth="0.7" opacity="0.22" />;
          })}

          {validEdges.map((pair, i) => {
            const A = pos[pair[0]], B = pos[pair[1]];
            const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
            const cx = mx + (CX - mx) * 0.35, cy = my + (CY - my) * 0.35;
            return (
              <path
                key={'edge-' + i}
                className="edge"
                d={`M ${A.x.toFixed(1)} ${A.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${B.x.toFixed(1)} ${B.y.toFixed(1)}`}
                fill="none" stroke="url(#edgeGrad)" strokeWidth="1.3" opacity="0.5"
              />
            );
          })}

          <g className="nucleo-anim" filter="url(#glow)">
            <circle cx={CX} cy={CY} r="42" fill="url(#coreGrad)" />
            <circle className="breath" cx={CX} cy={CY} r="52" fill="none" stroke="#8b7cff" strokeWidth="1" opacity="0.5" />
            <text x={CX} y={CY + 10} textAnchor="middle" fontSize="30">🧠</text>
          </g>

          {notes.map((nt) => {
            const p = pos[nt.id];
            const c = (AREA[nt.area] || AREA.meta).color;
            const r = 11 + Math.min(deg[nt.id] || 0, 8) * 1.7;
            return (
              <g key={nt.id} className="node-g" onClick={() => onNodeClick(nt.id)}>
                <circle className="breath" cx={p.x} cy={p.y} r={r + 8} fill="none" stroke={c} strokeWidth="1.4" />
                <circle id={'core-' + nt.id} className="core" cx={p.x} cy={p.y} r={r} fill={c} opacity="0.92" filter="url(#glow)" />
                <text x={p.x} y={p.y + r + 22} textAnchor="middle" fontSize="13.5" fill="#dbe7f5" fontFamily="ui-monospace,Menlo,monospace">
                  {nt.title}
                </text>
              </g>
            );
          })}

          {Array.from({ length: 12 }).map((_, i) => (
            <circle key={'pulse' + i} id={'pulse' + i} r="2.6" fill="#ffffff" opacity="0" filter="url(#glow)" />
          ))}
        </svg>
      </div>

      <div id="legend">
        {areasUsed.map((a) => {
          const info = AREA[a] || AREA.meta;
          return (
            <span key={a}>
              <span className="dot" style={{ background: info.color }} />
              {info.label}
            </span>
          );
        })}
        <span className="inject">✓ contexto injetado em todos os comandos</span>
      </div>
    </>
  );
}
