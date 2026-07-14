function unfoldICS(text) {
  return text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
}

function parseICSDate(line) {
  const isDateOnly = /VALUE=DATE/.test(line);
  const val = line.split(':').pop().trim();
  const y = +val.slice(0, 4), mo = +val.slice(4, 6) - 1, d = +val.slice(6, 8);
  if (isDateOnly) return { date: new Date(y, mo, d), allDay: true };
  const utc = val.endsWith('Z');
  const h = +val.slice(9, 11) || 0, mi = +val.slice(11, 13) || 0, s = +val.slice(13, 15) || 0;
  // Aproximação pragmática: TZID é tratado como o fuso do servidor (uso pessoal).
  const date = utc ? new Date(Date.UTC(y, mo, d, h, mi, s)) : new Date(y, mo, d, h, mi, s);
  return { date, allDay: false };
}

function decodeICSText(s) {
  return (s || '').replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

export function parseICS(text, calId) {
  const events = [];
  try {
    const lines = unfoldICS(text).split(/\r?\n/);
    let cur = null, inEvent = false;
    for (const line of lines) {
      if (line === 'BEGIN:VEVENT') {
        cur = { uid: '', summary: '', location: '', dtstartLine: '', dtendLine: '', rrule: '', exdates: [] };
        inEvent = true;
        continue;
      }
      if (line === 'END:VEVENT') { if (cur) events.push(cur); inEvent = false; cur = null; continue; }
      if (!inEvent || !cur) continue;
      if (line.startsWith('UID:')) cur.uid = line.slice(4);
      else if (line.startsWith('SUMMARY:')) cur.summary = decodeICSText(line.slice(8));
      else if (line.startsWith('LOCATION:')) cur.location = decodeICSText(line.slice(9));
      else if (line.startsWith('DTSTART')) cur.dtstartLine = line;
      else if (line.startsWith('DTEND')) cur.dtendLine = line;
      else if (line.startsWith('RRULE:')) cur.rrule = line.slice(6);
      else if (line.startsWith('EXDATE')) cur.exdates.push(line.split(':').pop().trim());
    }
  } catch (e) {
    // um link quebrado não pode derrubar as outras agendas
  }
  return events.map((ev) => ({ ...ev, calId }));
}

export function expandOccurrences(rawEvent, windowStart, windowEnd) {
  const startInfo = parseICSDate(rawEvent.dtstartLine);
  const endInfo = rawEvent.dtendLine ? parseICSDate(rawEvent.dtendLine) : null;
  const durationMs = endInfo ? endInfo.date - startInfo.date : 60 * 60 * 1000;
  const out = [];

  if (!rawEvent.rrule) {
    if (startInfo.date >= windowStart && startInfo.date <= windowEnd) {
      out.push({ start: startInfo.date, end: new Date(startInfo.date.getTime() + durationMs), allDay: startInfo.allDay });
    }
    return out;
  }

  const parts = {};
  rawEvent.rrule.split(';').forEach((p) => { const kv = p.split('='); parts[kv[0]] = kv[1]; });
  const freq = parts.FREQ;
  const interval = parseInt(parts.INTERVAL || '1', 10);
  const count = parts.COUNT ? parseInt(parts.COUNT, 10) : null;
  const until = parts.UNTIL ? parseICSDate('X:' + parts.UNTIL).date : null;
  const byday = parts.BYDAY ? parts.BYDAY.split(',') : null;
  const dayMap = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

  let cursor = new Date(startInfo.date), n = 0, iter = 0;
  while (iter < 2000) {
    iter++;
    if (count && n >= count) break;
    if (until && cursor > until) break;
    if (cursor > windowEnd) break;

    let occurs = true;
    if (freq === 'WEEKLY' && byday) occurs = byday.some((d) => dayMap[d] === cursor.getDay());
    if (occurs) {
      const inEx = rawEvent.exdates.some((ex) => parseICSDate('X:' + ex).date.toDateString() === cursor.toDateString());
      if (!inEx && cursor >= windowStart && cursor <= windowEnd) {
        out.push({ start: new Date(cursor), end: new Date(cursor.getTime() + durationMs), allDay: startInfo.allDay });
      }
      if (freq !== 'WEEKLY' || !byday) n++;
    }

    if (freq === 'DAILY') cursor.setDate(cursor.getDate() + interval);
    else if (freq === 'WEEKLY') { if (byday) cursor.setDate(cursor.getDate() + 1); else cursor.setDate(cursor.getDate() + 7 * interval); }
    else if (freq === 'MONTHLY') cursor.setMonth(cursor.getMonth() + interval);
    else if (freq === 'YEARLY') cursor.setFullYear(cursor.getFullYear() + interval);
    else break; // FREQ exótico — não expande, mas não derruba o resto
  }
  return out;
}
