export function isSameDay(a, b) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

export function dayLabel(d) {
  const date = new Date(d);
  const now = new Date();
  const tmr = new Date(now);
  tmr.setDate(now.getDate() + 1);
  if (isSameDay(date, tmr)) return 'AMANHÃ';
  const dias = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
  return dias[date.getDay()] + ' · ' + String(date.getDate()).padStart(2, '0') + '/' + String(date.getMonth() + 1).padStart(2, '0');
}

export function relTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const diffMin = Math.round((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return 'há ' + diffMin + 'min';
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return 'há ' + diffH + 'h';
  return 'há ' + Math.round(diffH / 24) + 'd';
}
