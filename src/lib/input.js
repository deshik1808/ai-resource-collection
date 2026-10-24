// Turns a Telegram message into text, URLs and a note.

const MAX_URLS = 5;
const URL_PATTERN = /https?:\/\/[^\s<>"']+/g;
const TRAILING_PUNCTUATION = /[.,;:!?)\]}]+$/;
const TRACKING_PARAMS = new Set(['si', 'feature', 'fbclid', 'gclid']);
const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be']);

// n8n Code nodes have no URL global, so URLs are parsed with a regex.
const URL_PARTS = /^(https?):\/\/([^/?#:\s]+)(:\d+)?([^?#\s]*)(\?[^#\s]*)?(#\S*)?$/i;

/** @returns {{protocol: string, host: string, port: string, path: string, params: string[][]}|null} */
function parseUrl(raw) {
  const m = URL_PARTS.exec(String(raw || '').trim());
  if (!m) return null;
  const query = m[5] ? m[5].slice(1) : '';
  const params = query ? query.split('&').filter(Boolean).map((pair) => {
    const at = pair.indexOf('=');
    return at === -1 ? [pair, ''] : [pair.slice(0, at), pair.slice(at + 1)];
  }) : [];
  return { protocol: m[1].toLowerCase(), host: m[2].toLowerCase(), port: m[3] || '', path: m[4] || '', params };
}

/** @returns {string|null} the video ID, or null when the URL is not a video */
function youTubeId(url) {
  if (!YOUTUBE_HOSTS.has(url.host)) return null;
  if (url.host === 'youtu.be') return url.path.split('/')[1] || null;
  if (url.path === '/watch') {
    const v = url.params.find(([key]) => key === 'v');
    return v ? v[1] : null;
  }
  const match = url.path.match(/^\/(shorts|embed|live)\/([^/]+)/);
  return match ? match[2] : null;
}

/** @param {string} raw @returns {string} */
function normalizeUrl(raw) {
  const url = parseUrl(raw);
  if (!url) return raw;
  const videoId = youTubeId(url);
  if (videoId) return `https://www.youtube.com/watch?v=${videoId}`;

  const kept = url.params.filter(([key]) => !TRACKING_PARAMS.has(key) && !key.startsWith('utm_'));
  const query = kept.length ? '?' + kept.map(([k, v]) => (v ? `${k}=${v}` : k)).join('&') : '';
  const path = url.path.replace(/\/+$/, '') || '/';
  return `${url.protocol}://${url.host}${url.port}${path}${query}`;
}

/** @param {string} raw @returns {boolean} true only for a YouTube video link */
function isYouTube(raw) {
  const url = parseUrl(raw);
  return Boolean(url && youTubeId(url));
}

/** @param {string} text @returns {{urls: string[], note: string}} */
function splitInput(text) {
  const urls = [];
  const note = text.replace(URL_PATTERN, (match) => {
    const clean = match.replace(TRAILING_PUNCTUATION, '');
    const normal = normalizeUrl(clean);
    if (urls.length < MAX_URLS && !urls.includes(normal)) urls.push(normal);
    return ' ' + match.slice(clean.length);
  });
  return {
    urls,
    note: note.replace(/\(\s*\)/g, ' ').replace(/\s+/g, ' ').trim(),
  };
}

/** @param {object} message Telegram message @returns {string|null} */
function messageText(message) {
  const text = message.text ?? message.caption ?? '';
  const entities = [...(message.entities || []), ...(message.caption_entities || [])];
  const hidden = entities
    .filter((e) => e.type === 'text_link' && e.url && !text.includes(e.url))
    .map((e) => e.url);
  const full = [text, ...hidden].join(' ').trim();
  return full === '' ? null : full;
}

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };

/** @param {string} html @param {number} max @returns {string} readable text of a web page */
function pageText(html, max) {
  return String(html || '')
    .replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (entity) => ENTITIES[entity])
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** @param {string} raw @returns {string} host without www, or '' */
function domainOf(raw) {
  const url = parseUrl(raw);
  return url ? url.host.replace(/^www\./, '') : '';
}

module.exports = { messageText, splitInput, normalizeUrl, isYouTube, pageText, domainOf };
