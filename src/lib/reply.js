// Telegram texts: the summary after saving, and /find results.

const ICONS = { Skill: '🧩', Tool: '🔧', Prompt: '💬', Website: '🌐' };
const TELEGRAM_LIMIT = 4096;
const PREVIEW_CHARS = 100;
const FIND_LIMIT = 10;
const SEARCH_FIELDS = ['name', 'category', 'description', 'link', 'note', 'prompt_text'];

function preview(text) {
  return String(text).slice(0, PREVIEW_CHARS);
}

function linkPart(row) {
  if (row.category === 'Prompt' && row.prompt_text) return preview(row.prompt_text);
  if (row.link_from === 'not found') return '❓ link not found';
  if (!row.link) return '';
  return row.link + (row.link_from === 'search' ? ' 🔎' : '');
}

function summaryLine(row) {
  const detail = [row.description, linkPart(row)].filter(Boolean).join(' · ');
  return `${ICONS[row.category] || ''} ${row.category} · ${row.name}${detail ? ` — ${detail}` : ''}`;
}

function formatSummary(saved, skipped, notices, label) {
  const found = saved.length + skipped.length;
  if (found === 0) return notices.length ? notices.join('\n') : 'Nothing found in this one';

  const header = `✅ ${found} found in this ${label}`;
  const body = [...saved.map(summaryLine), ...skipped.map((name) => `${name} — already saved`)];
  const fits = (lines) => [header, ...lines, ...notices].join('\n').length <= TELEGRAM_LIMIT;

  if (fits(body)) return [header, ...body, ...notices].join('\n');
  const shown = [];
  for (const line of body) {
    const more = `…and ${body.length - shown.length - 1} more in the Sheet.`;
    if (!fits([...shown, line, more])) break;
    shown.push(line);
  }
  const more = `…and ${body.length - shown.length} more in the Sheet.`;
  return [header, ...shown, more, ...notices].join('\n');
}

function findRows(rows, query) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = rows
    .filter((row) => row.status === 'ok')
    .filter((row) => {
      const haystack = SEARCH_FIELDS.map((f) => String(row[f] ?? '')).join(' ').toLowerCase();
      return words.every((w) => haystack.includes(w));
    })
    .sort((a, b) => String(b.saved_at).localeCompare(String(a.saved_at)));
  return { rows: matches.slice(0, FIND_LIMIT), more: Math.max(0, matches.length - FIND_LIMIT) };
}

function formatFind(query, result) {
  if (result.rows.length === 0) return `Nothing for "${query}".`;
  const lines = result.rows.map((row) => {
    const target = row.category === 'Prompt' && row.prompt_text ? preview(row.prompt_text) : row.link || '❓ no link';
    return `${ICONS[row.category] || ''} ${row.name} — ${target}`;
  });
  if (result.more > 0) lines.push(`…and ${result.more} more. Add a word or open the Sheet.`);
  return lines.join('\n');
}

module.exports = { ICONS, formatSummary, findRows, formatFind };
