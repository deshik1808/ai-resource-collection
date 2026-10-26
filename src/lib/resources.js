// Reads AI answers safely: the resource list, and a chosen search-result index.
// The AI is never trusted to write a URL that did not come from the source.

const CATEGORIES = ['Skill', 'Tool', 'Prompt', 'Website'];
const DESCRIPTION_MAX = 200;

function isHttpUrl(value) {
  return /^https?:\/\/[^\s/?#]+\.[^\s/?#]+(\S*)$/i.test(String(value || ''));
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

/** Name to search for: no bracketed credits, no trailing "skill" word. */
function searchName(name) {
  return String(name || '')
    .replace(/\([^)]*\)/g, ' ')
    .trim()
    .replace(/\s+skills?$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function skillKey(name) {
  return searchName(name).toLowerCase().replace(/[\s_]+/g, '-');
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

const REPO_LINK = /^https?:\/\/(?:www\.)?(?:github\.com|skills\.sh)\/([\w.-]+)\/([\w.-]+)/i;

/** @returns {string} 'owner/repo' of a GitHub or skills.sh link, or '' */
function repoOf(url) {
  const m = REPO_LINK.exec(String(url || ''));
  return m ? `${m[1]}/${m[2].replace(/\.git$/i, '')}` : '';
}

/** @returns {number|null} stars from a GitHub repo answer */
function repoStars(json) {
  const stars = json?.stargazers_count;
  return typeof stars === 'number' ? stars : null;
}

/** @returns {string} the repo's owner-written description, at most 200 characters */
function repoAbout(json) {
  return trimmed(json?.description).slice(0, DESCRIPTION_MAX);
}

/**
 * Popularity decides between the skills.sh match and same-named GitHub repos:
 * the most-starred one wins, so a small copy never beats the original.
 * Forks and partial names never count. Unknown stars lose to known ones.
 * @param {{url:string}|null} skillMatch from matchSkill
 * @param {object|null} pack GitHub answer for the skills.sh match's repo
 * @param {object[]} items GitHub repository search results
 * @returns {{url:string, link_from:string, stars:number|null, about:string}|null}
 */
function chooseLink(skillMatch, pack, items, name) {
  const wanted = skillKey(name);
  const repos = (items || []).filter((item) => item && !item.fork && skillKey(item.name) === wanted);
  const candidates = [];
  if (skillMatch) {
    const repo = repoOf(skillMatch.url).toLowerCase();
    const listed = (items || []).find((item) => String(item.full_name || repoOf(item.html_url)).toLowerCase() === repo);
    const stars = repoStars(pack) ?? repoStars(listed);
    candidates.push({ url: skillMatch.url, link_from: 'skills.sh', stars, about: repoAbout(pack) || repoAbout(listed), repo });
  }
  for (const item of repos) {
    if (candidates.some((c) => c.repo === repoOf(item.html_url).toLowerCase())) continue;
    candidates.push({ url: item.html_url, link_from: 'github', stars: repoStars(item), about: repoAbout(item), repo: repoOf(item.html_url).toLowerCase() });
  }
  let best = null;
  for (const c of candidates) {
    if (!best || (c.stars ?? -1) > (best.stars ?? -1)) best = c;
  }
  return best && { url: best.url, link_from: best.link_from, stars: best.stars, about: best.about };
}

/** Text of an AI answer: Gemini API or node output, or an OpenAI-style (NVIDIA NIM) response. */
function aiText(json) {
  const parts = json?.content?.parts || json?.candidates?.[0]?.content?.parts;
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
    max_tokens: 16384,
  };
}

/**
 * Gemini API body that lets Google fetch the YouTube video itself. Downloading
 * it from our server only gets YouTube's "not a bot" page, never the video.
 */
function watchRequest(videoUrl, prompt) {
  return {
    contents: [{ parts: [{ file_data: { file_uri: videoUrl } }, { text: prompt }] }],
    generationConfig: { maxOutputTokens: 8192 },
  };
}

/** What a reader's answer means for this job: resources to save, or a reason to hold it. */
function readerOutcome(job, raw, pageUrl) {
  const parsed = parseResources(raw);
  if (!parsed.ok) return { hold: { temporary: false, empty: false } };
  if (parsed.resources.length === 0) return { hold: { temporary: false, empty: true } };
  if (job.kind === 'page') {
    return { resources: [{ ...parsed.resources[0], link_in_source: pageUrl || job.source_url }] };
  }
  return { resources: parsed.resources };
}

/** A checked link is dead only on 404/410 or when the site cannot be reached at all. */
function linkAlive(response) {
  if (!response || response.error) return false;
  const code = Number(response.statusCode);
  return code !== 404 && code !== 410;
}

/**
 * Choices for the link picker: the top web results plus same-named GitHub
 * repos (never forks), so an open-source tool's repo can be picked even when
 * the web results are only articles about it.
 */
function pickCandidates(webResults, repoItems, name) {
  const wanted = skillKey(name);
  const repos = (repoItems || [])
    .filter((item) => item && !item.fork && skillKey(item.name) === wanted)
    .slice(0, 3)
    .map((item) => ({
      title: `GitHub repository ${item.full_name || repoOf(item.html_url)} (⭐ ${item.stargazers_count ?? '?'})`,
      url: item.html_url,
      content: trimmed(item.description),
    }));
  return [...(webResults || []).slice(0, 5), ...repos];
}

/** NIM request asking which numbered search result is the resource's official page. */
function pickRequest(model, prompt, resource, results) {
  const about = `${resource.name} (${resource.category})${resource.description ? `: ${resource.description}` : ''}`;
  const list = results
    .map((r, i) => `${i}. ${r.title} — ${r.url} — ${String(r.content || '').slice(0, 200)}`)
    .join('\n');
  return nimRequest(model, prompt, `${about}\n\nResults:\n${list}`);
}

module.exports = { parseResources, pickIndex, searchName, matchSkill, repoOf, repoStars, repoAbout, chooseLink, aiText, isTemporaryError, nimRequest, watchRequest, readerOutcome, linkAlive, pickCandidates, pickRequest };
