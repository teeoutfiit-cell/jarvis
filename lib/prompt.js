import { AREA } from './defaultData';

const norm = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export function buildSystemPrompt({ settings, agendaCompact, emailActionCompact }) {
  const notes = settings.notes || [];
  const byArea = {};
  notes.forEach((nt) => { (byArea[nt.area] = byArea[nt.area] || []).push(nt); });
  let brain = '';
  Object.keys(byArea).forEach((a) => {
    const label = (AREA[a] ? AREA[a].label : a).toUpperCase();
    brain += `\n[${label}]\n`;
    byArea[a].forEach((nt) => { brain += `- ${nt.title}: ${nt.body}\n`; });
  });

  return (
    `Você é ${settings.name}, assistente pessoal de voz com personalidade ${settings.persona} — ` +
    `elegante, preciso, levemente espirituoso, sempre tratando o usuário como "${settings.address}". ` +
    `Responda SEMPRE em português do Brasil, em 2 a 4 frases curtas e naturais para serem FALADAS em voz alta. ` +
    `Nunca use emojis, markdown, listas ou linguagem técnica desnecessária.\n\n` +
    `SECOND BRAIN — tudo o que você sabe sobre o usuário (use isso para personalizar TODA resposta):\n${brain}\n` +
    `CONTEXTO DE HOJE: ${agendaCompact} ${emailActionCompact}\n\n` +
    `Você também tem CENTRAL DE AGENDA (várias contas Google mescladas), CENTRAL DE E-MAILS ` +
    `(triados em AÇÃO/INFO/RUÍDO), RADAR DE NOTÍCIAS e MORNING DIGEST. Se perguntarem o que você sabe fazer, ` +
    `cite essas capacidades além de conversar livremente.\n\n` +
    `PROTOCOLO DE MEMÓRIA VIVA: se o usuário revelar algo NOVO e DURADOURO sobre a vida dele, ` +
    `TERMINE a resposta com uma linha no formato EXATO [[SAVE:area|titulo|texto]] ` +
    `(area deve ser uma destas: metas, trabalho, projetos, financas, aprendizado, saude, relacoes, meta). ` +
    `Se já existir nota com esse título, ela será atualizada; senão, nasce uma nova. ` +
    `Inclua a linha SOMENTE quando houver algo realmente novo e relevante.`
  );
}

// Aplica [[SAVE:area|titulo|texto]] direto no array de notas (mutando-o) e
// devolve o texto já limpo + quais ids mudaram (pra decidir o que salvar/piscar).
export function extractSaves(text, notes) {
  const re = /\[\[SAVE:([a-z_]+)\|([^|]+)\|([\s\S]+?)\]\]/g;
  let m;
  const changedIds = [];
  while ((m = re.exec(text)) !== null) {
    const area = AREA[m[1]] ? m[1] : 'meta';
    const title = m[2].trim().slice(0, 40);
    const body = m[3].trim();
    const existing = notes.find((nt) => norm(nt.title) === norm(title));
    if (existing) { existing.body = body; existing.area = area; changedIds.push(existing.id); }
    else {
      const id = 'n' + Date.now() + Math.floor(Math.random() * 999);
      notes.push({ id, area, title, body });
      changedIds.push(id);
    }
  }
  return { cleaned: text.replace(re, '').trim(), changed: changedIds.length > 0, changedIds };
}

export function emailActionCompact(triageMap) {
  const count = Object.values(triageMap || {}).filter((t) => t.balde === 'acao').length;
  return `E-mails pedindo ação: ${count}.`;
}
