// =====================================================
//  SuperX_RobRunPatchNotes - Steam BBCode/HTML -> Discord markdown
// =====================================================
const CLAN_IMAGE_BASE = 'https://clan.akamai.steamstatic.com/images';

function decodeEntities(text) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function fixImageUrl(url) {
  return url.trim().replace(/\{STEAM_CLAN_IMAGE\}/g, CLAN_IMAGE_BASE).replace(/^\/\//, 'https://');
}

/** Pulls image URLs out of the post (used for the embed banner). */
function extractImages(raw) {
  const images = [];
  const patterns = [
    /\[img(?:\s+src=["']?([^"'\]]+)["']?)?[^\]]*\]([^[]*)\[\/img\]/gi,
    /<img[^>]+src=["']([^"']+)["'][^>]*>/gi,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(raw)) !== null) {
      const url = (m[1] || m[2] || '').trim();
      if (url) images.push(fixImageUrl(url));
    }
  }
  return images.filter((u) => /^https?:\/\//.test(u));
}

function htmlToBBCode(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?p[^>]*>/gi, '\n')
    .replace(/<h[1-3][^>]*>/gi, '[h2]').replace(/<\/h[1-3]>/gi, '[/h2]')
    .replace(/<(b|strong)[^>]*>/gi, '[b]').replace(/<\/(b|strong)>/gi, '[/b]')
    .replace(/<(i|em)[^>]*>/gi, '[i]').replace(/<\/(i|em)>/gi, '[/i]')
    .replace(/<u[^>]*>/gi, '[u]').replace(/<\/u>/gi, '[/u]')
    .replace(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi, '[url=$1]').replace(/<\/a>/gi, '[/url]')
    .replace(/<ul[^>]*>/gi, '[list]').replace(/<\/ul>/gi, '[/list]')
    .replace(/<ol[^>]*>/gi, '[olist]').replace(/<\/ol>/gi, '[/olist]')
    .replace(/<li[^>]*>/gi, '[*]').replace(/<\/li>/gi, '')
    .replace(/<img[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '');
}

function convertLists(text) {
  // Ordered lists get numbers, normal lists get bullets
  text = text.replace(/\[olist\]([\s\S]*?)\[\/olist\]/gi, (_, body) => {
    let i = 0;
    return '\n' + body.split(/\[\*\]/).slice(1)
      .map((item) => `${++i}. ${item.replace(/\[\/\*\]/g, '').trim()}`)
      .join('\n') + '\n';
  });
  text = text.replace(/\[list\]([\s\S]*?)\[\/list\]/gi, (_, body) => {
    return '\n' + body.split(/\[\*\]/).slice(1)
      .map((item) => `• ${item.replace(/\[\/\*\]/g, '').trim()}`)
      .join('\n') + '\n';
  });
  return text.replace(/\[\*\]/g, '• ').replace(/\[\/\*\]/g, '');
}

/** Converts a Steam post body into clean Discord markdown. */
function toDiscordMarkdown(raw, feedType = 1) {
  let t = String(raw || '');
  if (feedType === 0 || /<\/?(p|br|div|li|ul)\b/i.test(t)) t = htmlToBBCode(t);

  t = t.replace(/\r\n?/g, '\n');

  // Remove images (the first one becomes the embed banner)
  t = t.replace(/\[img[^\]]*\][^[]*\[\/img\]/gi, '');

  // YouTube previews -> link
  t = t.replace(/\[previewyoutube=([\w-]+)[^\]]*\]\s*\[\/previewyoutube\]/gi, '\n▶ https://youtu.be/$1\n');

  // Paragraphs / breaks / rules
  t = t.replace(/\[p[^\]]*\]/gi, '').replace(/\[\/p\]/gi, '\n');
  t = t.replace(/\[br\]/gi, '\n').replace(/\[hr\]\s*\[\/hr\]|\[hr\]/gi, '\n───────────\n');

  // Headings
  t = t.replace(/\[h1\]([\s\S]*?)\[\/h1\]/gi, (_, x) => `\n**__${x.trim()}__**\n`);
  t = t.replace(/\[h[2-6]\]([\s\S]*?)\[\/h[2-6]\]/gi, (_, x) => `\n**${x.trim()}**\n`);

  // Lists
  t = convertLists(t);

  // Links
  t = t.replace(/\[url=["']?([^\]"']+)["']?[^\]]*\]([\s\S]*?)\[\/url\]/gi, (_, link, label) => {
    const l = label.trim();
    return l && l !== link ? `[${l}](${link})` : link;
  });
  t = t.replace(/\[url\]([\s\S]*?)\[\/url\]/gi, '$1');
  t = t.replace(/\[dynamiclink[^\]]*href=["']?([^\]"']+)["']?[^\]]*\]\s*\[\/dynamiclink\]/gi, '$1');

  // Text styles
  t = t.replace(/\[b\]([\s\S]*?)\[\/b\]/gi, '**$1**');
  t = t.replace(/\[i\]([\s\S]*?)\[\/i\]/gi, '*$1*');
  t = t.replace(/\[u\]([\s\S]*?)\[\/u\]/gi, '__$1__');
  t = t.replace(/\[strike\]([\s\S]*?)\[\/strike\]/gi, '~~$1~~');
  t = t.replace(/\[spoiler\]([\s\S]*?)\[\/spoiler\]/gi, '||$1||');
  t = t.replace(/\[code\]([\s\S]*?)\[\/code\]/gi, '```\n$1\n```');
  t = t.replace(/\[quote[^\]]*\]([\s\S]*?)\[\/quote\]/gi, (_, x) =>
    '\n' + x.trim().split('\n').map((l) => `> ${l}`).join('\n') + '\n');

  // Tables -> "cell | cell" rows
  t = t.replace(/\[tr\]([\s\S]*?)\[\/tr\]/gi, (_, row) => {
    const cells = [...row.matchAll(/\[t[hd][^\]]*\]([\s\S]*?)\[\/t[hd]\]/gi)].map((c) => c[1].trim());
    return cells.join(' | ') + '\n';
  });

  // Strip any leftover tags
  // (only known Steam tags, so Discord links like [text](url) are kept)
  t = t.replace(/\[\/?(table|noparse|h\d|list|olist|th|td|tr|expand|carousel|video|img|p|hr|br|url|b|i|u|strike|spoiler|code|quote|previewyoutube|dynamiclink|emoticon|sticker)(\s[^\]]*|=[^\]]*)?\]/gi, '');

  t = decodeEntities(t);

  // Tidy up spacing
  t = t
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\*\*\s*\*\*/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return t || '*No patch note text was included in this post. Open it on Steam for details.*';
}

/** Splits text into chunks under `max` chars, breaking on lines where possible. */
function splitText(text, max = 3900) {
  const chunks = [];
  let current = '';
  for (const line of text.split('\n')) {
    if (line.length > max) {
      if (current) { chunks.push(current); current = ''; }
      for (let i = 0; i < line.length; i += max) chunks.push(line.slice(i, i + max));
      continue;
    }
    if ((current + '\n' + line).length > max) {
      chunks.push(current);
      current = line;
    } else {
      current = current ? `${current}\n${line}` : line;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/** dd/mm/yyyy */
function formatDate(unixSeconds) {
  const d = new Date(unixSeconds * 1000);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

module.exports = { toDiscordMarkdown, extractImages, splitText, formatDate };
