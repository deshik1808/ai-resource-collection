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
