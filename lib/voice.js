// Pontua vozes disponíveis no navegador pra escolher a mais natural automaticamente.
// Vozes "Natural/Neural/Online/Wavenet/Premium" no nome costumam ser os modelos novos
// (ex: "Microsoft Thalita Online (Natural)" no Edge) — bem menos robóticas que as
// vozes clássicas do sistema.
export function scoreVoice(v, genderPref) {
  const name = (v.name || '').toLowerCase();
  const lang = (v.lang || '').toLowerCase();
  let score = 0;
  if (lang === 'pt-br') score += 5;
  else if (lang.startsWith('pt')) score += 2;
  if (/natural|neural|online|wavenet|premium/.test(name)) score += 10;
  const maleHints = ['male', 'daniel', 'felipe', 'ricardo', 'antonio', 'thiago', 'masculin'];
  const femaleHints = ['female', 'luciana', 'maria', 'francisca', 'fernanda', 'vitoria', 'camila', 'feminin'];
  const hints = (genderPref || 'masculina') === 'masculina' ? maleHints : femaleHints;
  if (hints.some((h) => name.includes(h))) score += 3;
  return score;
}

export function pickBestVoice(voices, genderPref, preferredName) {
  if (!voices || !voices.length) return null;
  if (preferredName) {
    const exact = voices.find((v) => v.name === preferredName);
    if (exact) return exact;
  }
  const ptVoices = voices.filter((v) => (v.lang || '').toLowerCase().startsWith('pt'));
  const pool = ptVoices.length ? ptVoices : voices;
  return pool.slice().sort((a, b) => scoreVoice(b, genderPref) - scoreVoice(a, genderPref))[0];
}

// Quebra o texto em frases — cada uma vira uma utterance separada, com uma
// variação sutil de ritmo/tom entre elas. Isso cria micro-pausas naturais
// entre frases em vez de uma fala única e monótona.
export function splitSentences(text) {
  const parts = (text || '').match(/[^.!?]+[.!?]*/g) || [text];
  return parts.map((p) => p.trim()).filter(Boolean);
}

// "09:00" / Date → "9h" · "14:30" / Date → "14h30" — bem mais natural de ouvir
// do que os dois-pontos, que alguns motores leem de forma estranha.
export function timeToSpeech(input) {
  let h, m;
  if (input instanceof Date) { h = input.getHours(); m = input.getMinutes(); }
  else { const [hh, mm] = String(input).split(':').map(Number); h = hh; m = mm || 0; }
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

// Junta uma lista em português falado: "A, B e C" em vez de "A, B, C" ou "A · B · C".
export function naturalJoin(items) {
  const arr = (items || []).filter(Boolean);
  if (arr.length <= 1) return arr.join('');
  if (arr.length === 2) return arr[0] + ' e ' + arr[1];
  return arr.slice(0, -1).join(', ') + ' e ' + arr[arr.length - 1];
}
