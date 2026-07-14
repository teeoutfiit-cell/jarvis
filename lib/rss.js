function extractTag(block, tag) {
  const m = block.match(new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)<\\/' + tag + '>'));
  if (!m) return '';
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, '$1').trim();
}

function decodeEntities(s) {
  return (s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

export function parseRss(xmlText, limit) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRegex.exec(xmlText)) && items.length < (limit || 10)) {
    const block = m[1];
    items.push({
      title: decodeEntities(extractTag(block, 'title')),
      link: extractTag(block, 'link'),
      pub: extractTag(block, 'pubDate')
    });
  }
  return items;
}

export function cleanNewsTitle(t) {
  const idx = t.lastIndexOf(' - ');
  return idx > -1 ? t.slice(0, idx) : t;
}

export function newsSource(t) {
  const idx = t.lastIndexOf(' - ');
  return idx > -1 ? t.slice(idx + 3) : '';
}
