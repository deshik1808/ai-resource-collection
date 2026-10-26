const { test } = require('node:test');
const assert = require('node:assert');
const { parseResources, pickIndex } = require('../src/lib/resources');

test('parseResources: fenced JSON with two resources, categories normalised', () => {
  const raw = '```json\n{"resources":[{"name":"superpowers","category":"skill","description":"Workflows"},' +
    '{"name":"NotebookLM","category":"TOOL","description":"Chat with PDFs","link_in_source":"https://notebooklm.google"}]}\n```';
  const out = parseResources(raw);
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.resources.length, 2);
  assert.deepStrictEqual(out.resources.map((r) => r.category), ['Skill', 'Tool']);
  assert.strictEqual(out.resources[1].link_in_source, 'https://notebooklm.google');
  assert.strictEqual(out.resources[0].prompt_text, '');
});

test('parseResources: JSON after leading prose', () => {
  const out = parseResources('Here you go: {"resources":[{"name":"X","category":"tool"}]}');
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.resources.length, 1);
  assert.strictEqual(out.resources[0].name, 'X');
});

test('parseResources: truncated JSON is not ok', () => {
  const out = parseResources('{"resources":[{"name":"X","categ');
  assert.strictEqual(out.ok, false);
  assert.ok(out.error);
});

test('parseResources: empty list is ok with no resources', () => {
  assert.deepStrictEqual(parseResources('{"resources":[]}'), { ok: true, resources: [] });
});

test('parseResources: missing resources array is not ok', () => {
  assert.strictEqual(parseResources('{"items":[]}').ok, false);
});

test('parseResources: drops nameless items, unknown category becomes Website, long description trimmed', () => {
  const out = parseResources(JSON.stringify({
    resources: [
      { name: '  ', category: 'Tool' },
      { name: 'Site', category: 'blog', description: 'd'.repeat(300) },
    ],
  }));
  assert.strictEqual(out.resources.length, 1);
  assert.strictEqual(out.resources[0].category, 'Website');
  assert.strictEqual(out.resources[0].description.length, 200);
});

test('parseResources: a link that is not an http(s) URL is dropped', () => {
  const out = parseResources('{"resources":[{"name":"X","category":"Tool","link_in_source":"not a url"},' +
    '{"name":"Y","category":"Tool","link_in_source":"ftp://y.com"}]}');
  assert.deepStrictEqual(out.resources.map((r) => r.link_in_source), ['', '']);
});

test('pickIndex: plain number and JSON index within range', () => {
  assert.strictEqual(pickIndex('2', 5), 2);
  assert.strictEqual(pickIndex(' 0 ', 5), 0);
  assert.strictEqual(pickIndex('{"index":0}', 5), 0);
});

test('pickIndex: out of range, none, or a URL gives null', () => {
  assert.strictEqual(pickIndex('7', 5), null);
  assert.strictEqual(pickIndex('-1', 5), null);
  assert.strictEqual(pickIndex('none', 5), null);
  assert.strictEqual(pickIndex('{"index":null}', 5), null);
  assert.strictEqual(pickIndex('https://x.com', 5), null);
  assert.strictEqual(pickIndex('2.5', 5), null);
});

const { matchSkill } = require('../src/lib/resources');
const skillsSh = require('./fixtures/probe/skills-sh.json').skills;

test('matchSkill: a skill pack name matches its repo and links to GitHub, beating a tiny same-named skill', () => {
  assert.deepStrictEqual(matchSkill(skillsSh, 'superpowers'), {
    name: 'superpowers',
    url: 'https://github.com/obra/superpowers',
  });
});

test('matchSkill: an exact skill name links to its skills.sh page', () => {
  assert.deepStrictEqual(matchSkill(skillsSh, 'using-superpowers'), {
    name: 'using-superpowers',
    url: 'https://skills.sh/obra/superpowers/using-superpowers',
  });
});

test('matchSkill: spaces, case and a trailing "skill" word are ignored; most installs wins', () => {
  assert.deepStrictEqual(matchSkill(skillsSh, 'Superpowers Lab skill'), {
    name: 'superpowers-lab',
    url: 'https://skills.sh/sickn33/agentic-awesome-skills/superpowers-lab',
  });
});

test('matchSkill: a partial word is not a match', () => {
  assert.strictEqual(matchSkill(skillsSh, 'power'), null);
  assert.strictEqual(matchSkill(skillsSh, 'lab'), null);
});

test('matchSkill: no results', () => {
  assert.strictEqual(matchSkill([], 'superpowers'), null);
});

const { aiText, isTemporaryError } = require('../src/lib/resources');

test('aiText: reads Gemini and NVIDIA NIM (OpenAI-style) answers', () => {
  assert.strictEqual(aiText({ content: { parts: [{ text: 'a' }, { text: 'b' }] } }), 'ab');
  assert.strictEqual(aiText({ choices: [{ message: { content: '{"resources":[]}' } }] }), '{"resources":[]}');
  assert.strictEqual(aiText({}), '');
});

test('isTemporaryError: quota, overload and server errors are temporary', () => {
  assert.strictEqual(isTemporaryError('Service unavailable - try again later or consider setting this node to retry automatically (in the node settings)'), true);
  assert.strictEqual(isTemporaryError({ message: 'The service is receiving too many requests from you', httpCode: '429' }), true);
  assert.strictEqual(isTemporaryError({ message: 'Resource has been exhausted (e.g. check quota).' }), true);
  assert.strictEqual(isTemporaryError({ message: 'Bad gateway', httpCode: '502' }), true);
});

test('isTemporaryError: a bad or private video is permanent', () => {
  assert.strictEqual(isTemporaryError({ message: 'Bad request - please check your parameters', httpCode: '400' }), false);
  assert.strictEqual(isTemporaryError({ message: 'The caller does not have permission', httpCode: '403' }), false);
  assert.strictEqual(isTemporaryError(undefined), false);
});

const { nimRequest, readerOutcome } = require('../src/lib/resources');

test('nimRequest: OpenAI-style chat body with prompt and content', () => {
  assert.deepStrictEqual(nimRequest('meta/llama-3.3-70b-instruct', 'PROMPT', 'CONTENT'), {
    model: 'meta/llama-3.3-70b-instruct',
    messages: [{ role: 'user', content: 'PROMPT\nCONTENT' }],
    temperature: 0.2,
    max_tokens: 16384,
  });
});

const job = (fields) => ({ chat_id: '1', kind: 'youtube', source_url: 'https://www.youtube.com/watch?v=a', note: '', text: '', retry_row: null, replace_row: null, ...fields });

test('readerOutcome: resources from a good answer', () => {
  const out = readerOutcome(job({}), '{"resources":[{"name":"A","category":"Skill"}]}');
  assert.deepStrictEqual(out.resources.map((r) => r.name), ['A']);
  assert.strictEqual(out.hold, undefined);
});

test('readerOutcome: a page job keeps one resource and links the shared URL', () => {
  const out = readerOutcome(job({ kind: 'page', source_url: 'https://github.com/obra/superpowers' }),
    '{"resources":[{"name":"superpowers","category":"Skill","link_in_source":""},{"name":"extra","category":"Tool"}]}');
  assert.strictEqual(out.resources.length, 1);
  assert.strictEqual(out.resources[0].link_in_source, 'https://github.com/obra/superpowers');
});

test('readerOutcome: broken answer holds for checking; empty answer holds as empty', () => {
  assert.deepStrictEqual(readerOutcome(job({}), '{"resources":[{"na').hold, { temporary: false, empty: false });
  assert.deepStrictEqual(readerOutcome(job({}), '{"resources":[]}').hold, { temporary: false, empty: true });
});

const { linkAlive, pickRequest } = require('../src/lib/resources');

test('linkAlive: only not-found answers or no answer at all mean dead', () => {
  assert.strictEqual(linkAlive({ statusCode: 200 }), true);
  assert.strictEqual(linkAlive({ statusCode: 403 }), true, 'sites that block bots still exist');
  assert.strictEqual(linkAlive({ statusCode: 429 }), true);
  assert.strictEqual(linkAlive({ statusCode: 404 }), false);
  assert.strictEqual(linkAlive({ statusCode: 410 }), false);
  assert.strictEqual(linkAlive({ error: { message: 'getaddrinfo ENOTFOUND x.example' } }), false);
});

test('pickRequest: numbered results, index-only answer', () => {
  const body = pickRequest('m', 'PICK', { name: 'NotebookLM', category: 'Tool', description: 'chat with PDFs' },
    [{ title: 'News', url: 'https://news.example/a', content: 'x'.repeat(500) }, { title: 'Gemini Notebook', url: 'https://workspace.google.com/products/gemini-notebook', content: 'official' }]);
  const text = body.messages[0].content;
  assert.ok(text.startsWith('PICK\n'));
  assert.ok(text.includes('NotebookLM (Tool): chat with PDFs'));
  assert.ok(text.includes('0. News — https://news.example/a — ' + 'x'.repeat(200)));
  assert.ok(!text.includes('x'.repeat(201)));
  assert.ok(text.includes('1. Gemini Notebook — https://workspace.google.com/products/gemini-notebook — official'));
  assert.strictEqual(body.model, 'm');
});

const { searchName, repoOf, chooseLink, repoStars } = require('../src/lib/resources');
const ghSearch = require('./fixtures/probe/github-search.json').items;
const copyRepo = require('./fixtures/probe/github-repo.json');
const skillsShSkillWord = require('./fixtures/probe/skills-sh-skill-word.json').skills;

test('searchName: drops a trailing "skill" word and bracketed credits', () => {
  assert.strictEqual(searchName('superpowers skill'), 'superpowers');
  assert.strictEqual(searchName('Superpowers Lab Skills'), 'Superpowers Lab');
  assert.strictEqual(searchName('motion (Emil Kowalski)'), 'motion');
  assert.strictEqual(searchName('  NotebookLM '), 'NotebookLM');
});

test('matchSkill: bracketed credits are ignored when matching', () => {
  assert.strictEqual(matchSkill(skillsSh, 'using-superpowers (Jesse Vincent)').name, 'using-superpowers');
});

test('repoOf: owner/repo of a GitHub or skills.sh link, else empty', () => {
  assert.strictEqual(repoOf('https://github.com/obra/superpowers'), 'obra/superpowers');
  assert.strictEqual(repoOf('https://github.com/obra/superpowers.git'), 'obra/superpowers');
  assert.strictEqual(repoOf('https://www.github.com/obra/superpowers/tree/main/skills'), 'obra/superpowers');
  assert.strictEqual(repoOf('https://skills.sh/obra/superpowers/using-superpowers'), 'obra/superpowers');
  assert.strictEqual(repoOf('https://github.com/obra'), '');
  assert.strictEqual(repoOf('https://notebooklm.google'), '');
  assert.strictEqual(repoOf(''), '');
});

test('repoStars: star count from a GitHub repo answer, null when missing', () => {
  assert.strictEqual(repoStars(copyRepo), 11);
  assert.strictEqual(repoStars({ message: 'API rate limit exceeded' }), null);
  assert.strictEqual(repoStars(undefined), null);
});

test('chooseLink: live bug — a 11-star copy from skills.sh loses to the 304k-star original', () => {
  const copy = matchSkill(skillsShSkillWord, 'superpowers skill');
  assert.strictEqual(copy.url, 'https://github.com/101-skills/superpowers', 'reproduces execution 4033');
  assert.deepStrictEqual(chooseLink(copy, copyRepo, ghSearch, 'superpowers skill'), {
    url: 'https://github.com/obra/superpowers',
    link_from: 'github',
    stars: 304545, about: ''
  });
});

test('chooseLink: a skill inside a popular pack keeps its skills.sh page', () => {
  const pack = { full_name: 'obra/superpowers', stargazers_count: 304545 };
  assert.deepStrictEqual(chooseLink(matchSkill(skillsSh, 'using-superpowers'), pack, ghSearch, 'using-superpowers'), {
    url: 'https://skills.sh/obra/superpowers/using-superpowers',
    link_from: 'skills.sh',
    stars: 304545, about: ''
  });
});

test('chooseLink: repo name must match exactly; forks never count', () => {
  const items = [
    { name: 'superpowers-zh', html_url: 'https://github.com/a/superpowers-zh', fork: false, stargazers_count: 9000 },
    { name: 'superpowers', html_url: 'https://github.com/b/superpowers', fork: true, stargazers_count: 5000 },
    { name: 'Superpowers', html_url: 'https://github.com/c/Superpowers', fork: false, stargazers_count: 40 },
  ];
  assert.deepStrictEqual(chooseLink(null, null, items, 'superpowers'), { url: 'https://github.com/c/Superpowers', link_from: 'github', stars: 40, about: '' });
});

test('chooseLink: GitHub unavailable keeps the skills.sh match with unknown stars', () => {
  const found = matchSkill(skillsSh, 'using-superpowers');
  assert.deepStrictEqual(chooseLink(found, null, [], 'using-superpowers'), { url: found.url, link_from: 'skills.sh', stars: null, about: '' });
});

test('chooseLink: the skills.sh pack found in GitHub search takes its stars from there', () => {
  const found = { name: 'superpowers', url: 'https://github.com/obra/superpowers' };
  assert.deepStrictEqual(chooseLink(found, null, ghSearch, 'superpowers'), { url: 'https://github.com/obra/superpowers', link_from: 'skills.sh', stars: 304545, about: '' });
});

test('chooseLink: nothing found', () => {
  assert.strictEqual(chooseLink(null, null, [], 'superpowers'), null);
});

test('chooseLink: carries the owner-written GitHub description as `about`', () => {
  const items = [{ name: 'superpowers', full_name: 'obra/superpowers', html_url: 'https://github.com/obra/superpowers', fork: false, stargazers_count: 304545, description: 'An agentic skills framework' }];
  assert.strictEqual(chooseLink(null, null, items, 'superpowers').about, 'An agentic skills framework');
  const pack = { full_name: 'obra/superpowers', stargazers_count: 304545, description: 'Pack text' };
  assert.strictEqual(chooseLink(matchSkill(skillsSh, 'using-superpowers'), pack, [], 'using-superpowers').about, 'Pack text');
  assert.strictEqual(chooseLink(matchSkill(skillsSh, 'using-superpowers'), null, [], 'using-superpowers').about, '');
});

const { repoAbout } = require('../src/lib/resources');

test('repoAbout: GitHub description, trimmed to 200 characters, empty when missing', () => {
  assert.strictEqual(repoAbout({ description: '  Skills for agents  ' }), 'Skills for agents');
  assert.strictEqual(repoAbout({ description: 'x'.repeat(300) }).length, 200);
  assert.strictEqual(repoAbout({ description: null }), '');
  assert.strictEqual(repoAbout(undefined), '');
});

const { watchRequest } = require('../src/lib/resources');

test('watchRequest: Google fetches the YouTube video itself (file_data), prompt after it', () => {
  assert.deepStrictEqual(watchRequest('https://www.youtube.com/watch?v=VbTsFtwjl1k', 'PROMPT'), {
    contents: [{ parts: [{ file_data: { file_uri: 'https://www.youtube.com/watch?v=VbTsFtwjl1k' } }, { text: 'PROMPT' }] }],
    generationConfig: { maxOutputTokens: 8192 },
  });
});

test('aiText: reads a raw Gemini API answer (candidates)', () => {
  assert.strictEqual(aiText({ candidates: [{ content: { parts: [{ text: '{"resources"' }, { text: ':[]}' }] } }] }), '{"resources":[]}');
});
