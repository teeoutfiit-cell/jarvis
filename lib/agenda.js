import { parseICS, expandOccurrences } from './ics';
import { saveSettings } from './settingsStore';
import { timeToSpeech, naturalJoin } from './voice';
import { startOfDayInTZ, dateKeyInTZ } from './tz';

export async function fetchMergedAgenda(calendars, tz) {
  const windowStart = startOfDayInTZ(tz);
  const windowEnd = new Date(windowStart.getTime() + 8 * 24 * 60 * 60 * 1000);

  let events = [];
  for (const cal of calendars || []) {
    const url = (cal.icsUrl || '').trim();
    if (!url || !/^https?:\/\//i.test(url)) continue;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JarvisNext/1.0)' },
        cache: 'no-store'
      });
      if (!res.ok) continue;
      const text = await res.text();
      const raws = parseICS(text, cal.id);
      raws.forEach((rw) => {
        expandOccurrences(rw, windowStart, windowEnd).forEach((o) => {
          events.push({
            start: o.start.toISOString(),
            end: o.end.toISOString(),
            allDay: o.allDay,
            summary: rw.summary || '(sem título)',
            location: rw.location || '',
            calId: cal.id,
            color: cal.color
          });
        });
      });
    } catch (e) {
      // uma agenda quebrada não derruba as outras
    }
  }
  events.sort((a, b) => new Date(a.start) - new Date(b.start));
  return events;
}

export async function getCachedAgenda(supabase, userId, settings, force, maxAgeMin) {
  const cache = settings.agendaCache || { ts: 0, events: [] };
  const ageMin = (Date.now() - (cache.ts || 0)) / 60000;
  if (!force && ageMin < (maxAgeMin || 10) && Array.isArray(cache.events)) {
    return cache.events;
  }
  const events = await fetchMergedAgenda(settings.calendars || [], settings.timezone);
  settings.agendaCache = { ts: Date.now(), events };
  await saveSettings(supabase, userId, settings);
  return events;
}

export function todayEventsCompact(events, tz) {
  const todayKey = dateKeyInTZ(new Date(), tz);
  const today = events.filter((e) => dateKeyInTZ(e.start, tz) === todayKey).slice(0, 15);
  if (!today.length) return 'Nenhum evento hoje.';
  const items = today.map((e) => {
    const t = e.allDay ? 'dia todo' : timeToSpeech(new Date(e.start));
    return t + ' ' + e.summary;
  });
  return 'Agenda de hoje: ' + naturalJoin(items) + '.';
}
