// O servidor (Vercel) roda em UTC. Sem isso, "hoje"/"agora" calculado no
// backend pode achar que já é amanhã enquanto ainda é noite no Brasil.
// Essas funções sempre calculam a data "de parede" no fuso informado.

export function nowInTZ(tz) {
  const zone = tz || 'America/Sao_Paulo';
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, weekday: 'short'
  });
  const parts = fmt.formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value;
  let hour = parseInt(get('hour'), 10);
  if (hour === 24) hour = 0;
  return {
    year: parseInt(get('year'), 10),
    month: parseInt(get('month'), 10),
    day: parseInt(get('day'), 10),
    hour,
    minute: parseInt(get('minute'), 10),
    second: parseInt(get('second'), 10),
    weekday: get('weekday') // "Mon", "Tue"...
  };
}

// "YYYY-MM-DD" no fuso dado — a chave certa pra comparar se algo é "hoje".
export function dateKeyInTZ(dateInput, tz) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz || 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
  });
  return fmt.format(d); // en-CA -> YYYY-MM-DD
}

const WEEKDAY_PT = {
  Sun: 'domingo', Mon: 'segunda-feira', Tue: 'terça-feira', Wed: 'quarta-feira',
  Thu: 'quinta-feira', Fri: 'sexta-feira', Sat: 'sábado'
};

export function todayLabelInTZ(tz) {
  const n = nowInTZ(tz);
  return `${WEEKDAY_PT[n.weekday] || n.weekday}, ${String(n.day).padStart(2, '0')}/${String(n.month).padStart(2, '0')}`;
}

// Instante absoluto (UTC) que corresponde à meia-noite de "hoje" no fuso dado.
// Necessário pra janela da agenda (hoje + 7 dias) não deslizar perto da meia-noite
// no Brasil, já que o servidor roda em UTC.
export function startOfDayInTZ(tz) {
  const zone = tz || 'America/Sao_Paulo';
  const n = nowInTZ(zone);
  const utcGuess = Date.UTC(n.year, n.month - 1, n.day, 0, 0, 0);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone, hour12: false, hour: '2-digit', minute: '2-digit',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date(utcGuess));
  const get = (t) => parseInt(parts.find((p) => p.type === t)?.value, 10);
  const localAsIfUTC = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), 0);
  const offsetMs = localAsIfUTC - utcGuess;
  return new Date(utcGuess - offsetMs);
}
