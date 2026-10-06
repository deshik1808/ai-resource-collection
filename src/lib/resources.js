// Reads AI answers safely: the resource list, and a chosen search-result index.
// The AI is never trusted to write a URL that did not come from the source.

const CATEGORIES = ['Skill', 'Tool', 'Prompt', 'Website'];
const DESCRIPTION_MAX = 200;

function isHttpUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function normaliseCategory(value) {
  const wanted = String(value || '').trim().toLowerCase();
  return CATEGORIES.find((c) => c.toLowerCase() === wanted) || 'Website';
}

function trimmed(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/** @param {string} raw @returns {{ok: true, resources: object[]} | {ok: false, error: string}} */
function parseResources(raw) {
  const source = String(raw ?? '');
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start === -1 || end <= start) return { ok: false, error: 'no JSON object in AI answer' };

  let data;
  try {
    data = JSON.parse(source.slice(start, end + 1));
  } catch (err) {
    return { ok: false, error: `invalid JSON: ${err.message}` };
  }
  if (!data || !Array.isArray(data.resources)) return { ok: false, error: 'missing resources array' };

  const resources = data.resources
    .filter((item) => item && trimmed(item.name))
    .map((item) => ({
      name: trimmed(item.name),
      category: normaliseCategory(item.category),
      description: trimmed(item.description).slice(0, DESCRIPTION_MAX),
      link_in_source: isHttpUrl(trimmed(item.link_in_source)) ? trimmed(item.link_in_source) : '',
      prompt_text: trimmed(item.prompt_text),
    }));
  return { ok: true, resources };
}

/** @param {string} raw @param {number} count @returns {number|null} */
function pickIndex(raw, count) {
  let value = String(raw ?? '').trim();
  if (value.startsWith('{')) {
    try {
      value = String(JSON.parse(value).index);
    } catch {
      return null;
    }
  }
  if (!/^\d+$/.test(value)) return null;
  const index = Number(value);
  return index < count ? index : null;
}

function skillKey(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+skills?$/, '')
    .replace(/[\s_]+/g, '-');
}

/**
 * Exact matches only: a skill whose name is the searched name, or a skill pack
 * (repo) whose name is. The most-installed match wins.
 * @param {{id:string, source:string, name:string, installs:number}[]} results skills.sh search results
 * @returns {{name: string, url: string}|null}
 */
function matchSkill(results, name) {
  const wanted = skillKey(name);
  if (!wanted) return null;
  let best = null;
  const consider = (candidate) => {
    if (!best || candidate.installs > best.installs) best = candidate;
  };
  for (const skill of results) {
    const installs = Number(skill.installs) || 0;
    if (skillKey(skill.name) === wanted) {
      consider({ name: skill.name, url: `https://skills.sh/${skill.id}`, installs });
    }
    const repo = String(skill.source || '').split('/');
    if (repo.length === 2 && skillKey(repo[1]) === wanted) {
      consider({ name: repo[1], url: `https://github.com/${skill.source}`, installs });
    }
  }
  return best && { name: best.name, url: best.url };
}

/** Text of an AI answer: Gemini node output or an OpenAI-style (NVIDIA NIM) response. */
function aiText(json) {
  const parts = json?.content?.parts;
  if (Array.isArray(parts)) return parts.map((p) => p.text || '').join('');
  return json?.choices?.[0]?.message?.content || '';
}

const TEMPORARY = /unavailable|overloaded|too many requests|rate limit|quota|exhausted|timed? ?out|try again later/i;

/** True for errors worth retrying later (quota, overload, server errors), false for a bad request. */
function isTemporaryError(error) {
  if (!error) return false;
  const message = typeof error === 'string' ? error : `${error.message || ''} ${error.description || ''}`;
  const code = typeof error === 'object' ? String(error.httpCode || '') : '';
  return code === '429' || /^5\d\d$/.test(code) || TEMPORARY.test(message);
}

/** Body for an NVIDIA NIM (OpenAI-compatible) chat completion. */
function nimRequest(model, prompt, content) {
  return {
    model,
    messages: [{ role: 'user', content: `${prompt}\n${content}` }],
    temperature: 0.2,
    max_tokens: 4096,
  };
}

/** What a reader's answer means for this job: resources to save, or a reason to hold it. */
function readerOutcome(job, raw) {
  const parsed = parseResources(raw);
  if (!parsed.ok) return { hold: { temporary: false, empty: false } };
  if (parsed.resources.length === 0) return { hold: { temporary: false, empty: true } };
  if (job.kind === 'page') {
    return { resources: [{ ...parsed.resources[0], link_in_source: job.source_url }] };
  }
  return { resources: parsed.resources };
}

module.exports = { parseResources, pickIndex, matchSkill, aiText, isTemporaryError, nimRequest, readerOutcome };
