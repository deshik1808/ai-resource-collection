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

function text(value) {
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
    .filter((item) => item && text(item.name))
    .map((item) => ({
      name: text(item.name),
      category: normaliseCategory(item.category),
      description: text(item.description).slice(0, DESCRIPTION_MAX),
      link_in_source: isHttpUrl(text(item.link_in_source)) ? text(item.link_in_source) : '',
      prompt_text: text(item.prompt_text),
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

module.exports = { parseResources, pickIndex, matchSkill };
