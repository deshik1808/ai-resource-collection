// Rows of the "AI Basket" Sheet: building them, spotting duplicates,
// deciding what to process, and retry bookkeeping.

const { splitInput, normalizeUrl, isYouTube } = require('./input');
const { holdNotice } = require('./reply');

const MAX_ATTEMPTS = 3;

/** @param {Date} now @returns {string} IST time as YYYY-MM-DD HH:mm */
function istStamp(now) {
  return now.toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).slice(0, 16);
}

/** @typedef {{name:string, category:'Skill'|'Tool'|'Prompt'|'Website', description:string, link_in_source:string, prompt_text:string}} Resource */
/** @typedef {{saved_at:string, name:string, category:string, description:string, link:string, link_from:string, prompt_text:string, source_url:string, note:string, status:string, attempts:number, row_number?:number}} Row */
/** @typedef {{chat_id:string, kind:'youtube'|'page'|'text', source_url:string, note:string, text:string, retry_row:number|null, replace_row:number|null}} Job */

/** @param {Resource} r @returns {Row} */
function toRow(r, ctx) {
  return {
    saved_at: istStamp(ctx.now),
    name: r.name,
    category: r.category,
    description: r.description,
    link: ctx.link,
    link_from: ctx.link_from,
    prompt_text: r.prompt_text || '',
    source_url: ctx.source_url,
    note: ctx.note,
    status: 'ok',
    attempts: 0,
  };
}

function holdRow(ctx) {
  return {
    saved_at: istStamp(ctx.now),
    name: ctx.name || '',
    category: '',
    description: '',
    link: '',
    link_from: '',
    prompt_text: '',
    source_url: ctx.source_url,
    note: ctx.note,
    status: ctx.status,
    attempts: 0,
  };
}

function sameName(a, b) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function findDuplicate(r, link, rows) {
  const wanted = link ? normalizeUrl(link) : '';
  return (
    rows.find((row) => {
      if (row.status !== 'ok') return false;
      if (wanted && row.link && normalizeUrl(row.link) === wanted) return true;
      return Boolean(r.name && row.name) && sameName(r.name, row.name) && r.category === row.category;
    }) || null
  );
}

/** Status of a source URL across all rows: ok beats pending beats check. */
function sourceStatus(sourceUrl, rows) {
  const matches = rows.filter((row) => row.source_url === sourceUrl);
  return (
    matches.find((row) => row.status === 'ok') ||
    matches.find((row) => row.status === 'pending') ||
    matches.filter((row) => row.status === 'check').pop() ||
    null
  );
}

function job(input, kind, sourceUrl, note, replaceRow) {
  return {
    chat_id: input.chat_id,
    kind,
    source_url: sourceUrl,
    note,
    text: input.text,
    retry_row: input.retry_row ?? null,
    replace_row: replaceRow,
  };
}

function planJobs(input, rows) {
  const { urls, note } = splitInput(input.text);
  const kindOf = (url) => (isYouTube(url) ? 'youtube' : 'page');

  if (input.retry_row != null) {
    const url = urls[0];
    return { jobs: [job(input, url ? kindOf(url) : 'text', url || '', note, null)], notices: [] };
  }
  if (urls.length === 0) {
    return { jobs: [job(input, 'text', '', '', null)], notices: [] };
  }

  const jobs = [];
  const notices = [];
  for (const url of urls) {
    const existing = sourceStatus(url, rows);
    if (existing && existing.status === 'ok') {
      notices.push(`Already saved on ${String(existing.saved_at).slice(0, 10)}`);
    } else if (existing && existing.status === 'pending') {
      notices.push('Already queued, will retry');
    } else {
      jobs.push(job(input, kindOf(url), url, note, existing ? existing.row_number : null));
    }
  }
  return { jobs, notices };
}

function nextRetryState(row) {
  const attempts = (Number(row.attempts) || 0) + 1;
  return { status: attempts >= MAX_ATTEMPTS ? 'check' : 'pending', attempts };
}

/**
 * How to record an input that could not be saved. Only Gemini problems are
 * temporary (pending, retried later); everything else goes to `check`.
 * @param {Job} job @param {{temporary: boolean, empty: boolean, name?: string}} reason
 * @returns {{op: 'append', row: Row, notice: string} | {op: 'update', update: object, notice: string} | {op: 'none', notice: string}}
 */
function holdPlan(job, reason, rows, now) {
  const status = reason.temporary && job.kind === 'youtube' ? 'pending' : 'check';
  const notice = holdNotice({ status, kind: job.kind, empty: reason.empty });

  if (job.retry_row != null) {
    const existing = rows.find((row) => Number(row.row_number) === Number(job.retry_row)) || {};
    const next = status === 'pending'
      ? nextRetryState(existing)
      : { status: 'check', attempts: (Number(existing.attempts) || 0) + 1 };
    const quietNotice = next.status === 'pending' ? '' : holdNotice({ status: 'check', kind: job.kind, empty: reason.empty });
    return { op: 'update', update: { row_number: Number(job.retry_row), ...next }, notice: quietNotice };
  }
  if (job.replace_row != null) return { op: 'none', notice };

  const row = holdRow({
    source_url: job.source_url,
    note: job.kind === 'text' ? job.text : job.note,
    status,
    now,
    name: reason.name,
  });
  return { op: 'append', row, notice };
}

module.exports = { toRow, holdRow, findDuplicate, planJobs, nextRetryState, holdPlan };
