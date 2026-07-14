const norm = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export function heuristicTriage(m) {
  const s = norm((m.de || '') + ' ' + (m.assunto || '') + ' ' + (m.trecho || ''));
  if (/noreply|newsletter|unsubscribe|promo|desinscrever|descadastr/.test(s)) {
    return { balde: 'ruido', resumo: 'Provável promoção ou newsletter (triagem local).' };
  }
  if (/\?|prazo|fatura|reuniao|por favor|confirm|aprova|urgente/.test(s)) {
    return { balde: 'acao', resumo: 'Pode exigir resposta ou ação (triagem local).' };
  }
  return { balde: 'info', resumo: 'Sem sinais claros de ação (triagem local).' };
}
