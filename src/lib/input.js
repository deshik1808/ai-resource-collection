// Turns a Telegram message into text, URLs and a note.

const MAX_URLS = 5;
const URL_PATTERN = /https?:\/\/[^\s<>"']+/g;
const TRAILING_PUNCTUATION = /[.,;:!?)\]}]+$/;
const TRACKING_PARAMS = new Set(['si', 'feature', 'fbclid', 'gclid']);
const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be']);

/** @param {URL} url @returns {string|null} the video ID, or null when the URL is not a video */
function youTubeId(url) {
  const host = url.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(host)) return null;
  if (host === 'youtu.be') return url.pathname.split('/')[1] || null;
  if (url.pathname === '/watch') return url.searchParams.get('v');
  const match = url.pathname.match(/^\/(shorts|embed|live)\/([^/]+)/);
  return match ? match[2] : null;
}

function parseUrl(raw) {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

/** @param {string} raw @returns {string} */
function normalizeUrl(raw) {
  const url = parseUrl(raw);
  if (!url) return raw;
  const videoId = youTubeId(url);
  if (videoId) return `https://www.youtube.com/watch?v=${videoId}`;

  url.hostname = url.hostname.toLowerCase();
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(key) || key.startsWith('utm_')) url.searchParams.delete(key);
  }
  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.replace(/\/+$/, '');
  }
  return url.toString();
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

module.exports = { messageText, splitInput, normalizeUrl, isYouTube };
