// =====================================================
//  SuperX_RobRunPatchNotes v1.0.0 (GitHub Actions version)
//  Runs every 15 minutes on GitHub, checks Steam for new
//  ROB RUN patch notes and posts them through a Discord webhook.
//  by SuperX_Customs
// =====================================================
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { toDiscordMarkdown, extractImages, splitText, formatDate } = require('./format');

const STATE_FILE = path.join(__dirname, 'state.json');
const WEBHOOK = (process.env.DISCORD_WEBHOOK_URL || '').trim();
const ROLE_ID = (process.env.ROLE_ID || '').trim();
const REPOST_LATEST = String(process.env.REPOST_LATEST) === 'true';
const KEEPALIVE_DAYS = 7;

const log = (...a) => console.log('[SuperX_RobRunPatchNotes]', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- State ----------
function loadState() {
  try { return { initialized: false, postedGids: [], lastKeepalive: null, ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) }; }
  catch { return { initialized: false, postedGids: [], lastKeepalive: null }; }
}
function saveState(s) {
  s.postedGids = s.postedGids.slice(-200);
  fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2) + '\n');
}

// ---------- Steam ----------
const headerImage = () => `https://cdn.akamai.steamstatic.com/steam/apps/${config.steamAppId}/header.jpg`;

async function fetchNews() {
  const params = new URLSearchParams({
    appid: String(config.steamAppId), count: '15', maxlength: '0', format: 'json',
    feeds: 'steam_community_announcements',
  });
  const res = await fetch(`https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?${params}`, {
    headers: { 'User-Agent': 'SuperX_RobRunPatchNotes/1.0.0' },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Steam returned HTTP ${res.status}`);
  const items = (await res.json())?.appnews?.newsitems ?? [];
  return items.map((n) => ({
    gid: String(n.gid),
    title: n.title || 'Untitled update',
    url: n.url || `https://store.steampowered.com/news/app/${config.steamAppId}`,
    contents: n.contents || '',
    date: Number(n.date) || Math.floor(Date.now() / 1000),
    tags: Array.isArray(n.tags) ? n.tags.map((t) => String(t).toLowerCase()) : [],
    feedType: Number(n.feed_type ?? 1),
  })).sort((a, b) => b.date - a.date);
}

function isPatchNote(item) {
  if (config.postMode === 'all') return true;
  if (item.tags.includes('patchnotes')) return true;
  const t = item.title.toLowerCase();
  return config.patchKeywords.some((k) => t.includes(k.toLowerCase()));
}

// ---------- Discord ----------
function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }

function buildPayloads(item) {
  const chunks = splitText(toDiscordMarkdown(item.contents, item.feedType), 3900);
  const banner = extractImages(item.contents)[0] || headerImage();
  const footer = `${config.embed.footerText} • ${formatDate(item.date)}`;

  const embeds = chunks.map((chunk, i) => {
    const e = { color: config.embed.color, description: chunk };
    if (i === 0) {
      e.author = { name: config.embed.authorName, url: item.url };
      e.title = truncate(item.title, 256);
      e.url = item.url;
    }
    const last = i === chunks.length - 1;
    if (chunks.length > 1) e.footer = { text: last ? `${footer} • Part ${i + 1}/${chunks.length}` : `Part ${i + 1}/${chunks.length}` };
    else e.footer = { text: footer };
    if (last && config.embed.showImage) e.image = { url: banner };
    return e;
  });

  // Pack into messages (Discord: max 10 embeds and ~6000 chars per message)
  const groups = [];
  let group = [], size = 0;
  for (const e of embeds) {
    const len = JSON.stringify(e).length;
    if (group.length && (size + len > 5800 || group.length >= 10)) { groups.push(group); group = []; size = 0; }
    group.push(e); size += len;
  }
  if (group.length) groups.push(group);

  return groups.map((g, i) => {
    const p = { embeds: g, allowed_mentions: { parse: [], roles: ROLE_ID ? [ROLE_ID] : [] } };
    if (config.webhook.username) p.username = config.webhook.username;
    if (config.webhook.avatarUrl) p.avatar_url = config.webhook.avatarUrl;
    if (i === 0) p.content = ROLE_ID ? `<@&${ROLE_ID}> ${config.embed.announceText}` : `**${config.gameName}** ${config.embed.announceText}`;
    if (i === groups.length - 1) {
      p.components = [{ type: 1, components: [{ type: 2, style: 5, label: 'Read on Steam', url: item.url }] }];
    }
    return p;
  });
}

async function sendWebhook(payload, attempt = 1) {
  const res = await fetch(`${WEBHOOK}?wait=true&with_components=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000),
  });
  if (res.status === 429 && attempt <= 5) {
    const body = await res.json().catch(() => ({}));
    await sleep(Math.ceil((body.retry_after || 2) * 1000) + 250);
    return sendWebhook(payload, attempt + 1);
  }
  if (res.status === 400 && payload.components) {
    // Some webhooks can't send buttons - send without it (the title still links to Steam)
    const { components, ...rest } = payload;
    return sendWebhook(rest, attempt);
  }
  if (!res.ok) throw new Error(`Discord webhook returned HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

async function post(item) {
  for (const p of buildPayloads(item)) {
    await sendWebhook(p);
    await sleep(1200);
  }
  log(`Posted: "${item.title}"`);
}

// ---------- Main ----------
async function main() {
  if (!/^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//.test(WEBHOOK)) {
    console.error('[SuperX_RobRunPatchNotes] DISCORD_WEBHOOK_URL secret is missing or wrong. Add it in GitHub: Settings → Secrets and variables → Actions.');
    process.exit(1);
  }

  const state = loadState();
  const news = (await fetchNews()).filter(isPatchNote);
  log(`Found ${news.length} patch note post(s) on Steam.`);

  if (REPOST_LATEST && news[0]) {
    await post(news[0]);
    if (!state.postedGids.includes(news[0].gid)) state.postedGids.push(news[0].gid);
  }

  if (!state.initialized) {
    news.forEach((n) => { if (!state.postedGids.includes(n.gid)) state.postedGids.push(n.gid); });
    state.initialized = true;
    log(`First run - marked ${news.length} existing post(s) as seen.`);
    if (config.postLatestOnFirstRun && news[0] && !REPOST_LATEST) await post(news[0]);
  } else {
    const fresh = news.filter((n) => !state.postedGids.includes(n.gid)).sort((a, b) => a.date - b.date);
    for (const item of fresh) {
      await post(item);
      state.postedGids.push(item.gid); // only marked after it posted, so failures retry next run
      saveState(state);
    }
    if (!fresh.length) log('No new patch notes.');
  }

  // Weekly check-in so GitHub doesn't pause the schedule on a quiet repo
  const last = state.lastKeepalive ? Date.parse(state.lastKeepalive) : 0;
  if (Date.now() - last > KEEPALIVE_DAYS * 86400000) state.lastKeepalive = new Date().toISOString();

  saveState(state);
}

main().catch((err) => {
  console.error('[SuperX_RobRunPatchNotes] Failed:', err.message);
  process.exit(1);
});
