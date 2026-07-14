import tls from 'tls';

export const IMAP_ALLOWLIST = new Set([
  'imap.gmail.com',
  'imap.mail.yahoo.com',
  'outlook.office365.com',
  'imap.mail.me.com'
]);

function createImapReader(socket) {
  let buffer = Buffer.alloc(0);
  let waitingLiteral = null;
  const tokenQueue = [];
  let waiters = [];

  function emit(tok) {
    if (waiters.length) waiters.shift()(tok);
    else tokenQueue.push(tok);
  }

  function pump() {
    let progress = true;
    while (progress) {
      progress = false;
      if (waitingLiteral !== null) {
        if (buffer.length >= waitingLiteral) {
          const data = buffer.slice(0, waitingLiteral);
          buffer = buffer.slice(waitingLiteral);
          emit({ type: 'literal', data });
          waitingLiteral = null;
          progress = true;
        }
      } else {
        const idx = buffer.indexOf('\r\n');
        if (idx !== -1) {
          const lineBuf = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const line = lineBuf.toString('utf8');
          emit({ type: 'line', text: line });
          const m = line.match(/\{(\d+)\}\s*$/);
          if (m) waitingLiteral = parseInt(m[1], 10);
          progress = true;
        }
      }
    }
  }

  socket.on('data', (chunk) => { buffer = Buffer.concat([buffer, chunk]); pump(); });

  return {
    nextToken() {
      if (tokenQueue.length) return Promise.resolve(tokenQueue.shift());
      return new Promise((resolve) => waiters.push(resolve));
    }
  };
}

async function readUntilTagged(reader, tag) {
  const tokens = [];
  while (true) {
    const tok = await reader.nextToken();
    tokens.push(tok);
    if (tok.type === 'line' && tok.text.indexOf(tag + ' ') === 0) return tokens;
  }
}

function imapQuote(s) {
  return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

function parseHeaderBlock(buf) {
  const text = (buf || Buffer.alloc(0)).toString('utf8');
  const unfolded = text.replace(/\r\n[ \t]/g, ' ');
  const out = {};
  unfolded.split(/\r\n/).forEach((line) => {
    const idx = line.indexOf(':');
    if (idx === -1) return;
    out[line.slice(0, idx).trim().toUpperCase()] = line.slice(idx + 1).trim();
  });
  return out;
}

function decodeQuotedPrintable(s) {
  const bytes = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(s.substr(i + 1, 2))) {
      bytes.push(parseInt(s.substr(i + 1, 2), 16));
      i += 2;
    } else if (s[i] === '=' && (s[i + 1] === '\r' || s[i + 1] === '\n')) {
      // soft line break — ignora o '='
    } else {
      bytes.push(s.charCodeAt(i));
    }
  }
  return Buffer.from(bytes).toString('utf8');
}

function decodeMimeWord(s) {
  if (!s) return '';
  return s.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (m, charset, enc, data) => {
    try {
      if (enc.toUpperCase() === 'B') return Buffer.from(data, 'base64').toString('utf8');
      return decodeQuotedPrintable(data.replace(/_/g, ' '));
    } catch (e) { return data; }
  });
}

function stripHtml(s) {
  return s
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"');
}

function extractSnippet(h, textBuf) {
  let raw = (textBuf || Buffer.alloc(0)).toString('utf8');
  const ct = h['CONTENT-TYPE'] || '';
  const boundaryMatch = ct.match(/boundary="?([^";]+)"?/i);
  if (/multipart/i.test(ct) && boundaryMatch) {
    const boundary = boundaryMatch[1];
    const parts = raw.split('--' + boundary);
    let plain = null, html = null;
    for (const part of parts) {
      if (!plain && /Content-Type:\s*text\/plain/i.test(part)) plain = part;
      else if (!html && /Content-Type:\s*text\/html/i.test(part)) html = part;
    }
    const chosen = plain || html;
    if (chosen) {
      const idx = chosen.indexOf('\r\n\r\n');
      let piece = idx !== -1 ? chosen.slice(idx + 4) : chosen;
      if (/Content-Transfer-Encoding:\s*quoted-printable/i.test(chosen)) piece = decodeQuotedPrintable(piece);
      else if (/Content-Transfer-Encoding:\s*base64/i.test(chosen)) {
        try { piece = Buffer.from(piece.replace(/\s+/g, ''), 'base64').toString('utf8'); } catch (e) {}
      }
      raw = plain === chosen ? piece : stripHtml(piece);
    }
  } else if (/text\/html/i.test(ct)) {
    raw = stripHtml(raw);
  }
  return raw.replace(/\s+/g, ' ').trim().slice(0, 500);
}

export function fetchEmailsIMAP({ host, usuario, senhaApp, quantidade }) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const socket = tls.connect({ host, port: 993, servername: host }, () => {});
    const done = (fn, val) => {
      if (settled) return;
      settled = true;
      try { socket.end(); } catch (e) {}
      fn(val);
    };

    socket.setTimeout(20000, () => done(reject, new Error('timeout')));
    socket.on('error', (e) => done(reject, new Error('conexao: ' + e.message)));

    const reader = createImapReader(socket);

    (async () => {
      try {
        await reader.nextToken(); // greeting do servidor

        socket.write('a1 LOGIN ' + imapQuote(usuario) + ' ' + imapQuote(senhaApp) + '\r\n');
        const loginResp = await readUntilTagged(reader, 'a1');
        const loginLast = loginResp[loginResp.length - 1].text;
        if (!/^a1 OK/i.test(loginLast)) return done(reject, new Error('login_failed'));

        socket.write('a2 EXAMINE INBOX\r\n');
        const examResp = await readUntilTagged(reader, 'a2');
        let exists = 0;
        examResp.forEach((tok) => {
          if (tok.type === 'line') {
            const m = tok.text.match(/^\* (\d+) EXISTS/);
            if (m) exists = parseInt(m[1], 10);
          }
        });

        if (exists === 0) return done(resolve, { emails: [] });

        const qtd = Math.max(1, Math.min(quantidade || 20, exists));
        const start = Math.max(1, exists - qtd + 1);
        const end = exists;

        socket.write(
          'a3 FETCH ' + start + ':' + end +
          ' (BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE MESSAGE-ID CONTENT-TYPE)] BODY.PEEK[TEXT]<0.4000>)\r\n'
        );
        const fetchResp = await readUntilTagged(reader, 'a3');

        const raw = {};
        let currentSeq = null, pendingKind = null;
        for (const tok of fetchResp) {
          if (tok.type === 'line') {
            const m = tok.text.match(/^\* (\d+) FETCH/);
            if (m) { currentSeq = m[1]; raw[currentSeq] = raw[currentSeq] || {}; }
            if (/HEADER\.FIELDS/i.test(tok.text)) pendingKind = 'header';
            else if (/BODY\[TEXT/i.test(tok.text)) pendingKind = 'text';
          } else if (tok.type === 'literal') {
            if (currentSeq && pendingKind) { raw[currentSeq][pendingKind] = tok.data; pendingKind = null; }
          }
        }

        const emails = Object.keys(raw)
          .sort((a, b) => +b - +a)
          .map((seq) => {
            const h = parseHeaderBlock(raw[seq].header);
            const de = decodeMimeWord(h['FROM'] || '');
            const assunto = decodeMimeWord(h['SUBJECT'] || '(sem assunto)');
            const data = h['DATE'] || '';
            const id = (h['MESSAGE-ID'] || host + '-' + seq).trim();
            const trecho = extractSnippet(h, raw[seq].text);
            return { id, de, assunto, data, trecho };
          });

        socket.write('a4 LOGOUT\r\n');
        done(resolve, { emails });
      } catch (e) {
        done(reject, e);
      }
    })();
  });
}
