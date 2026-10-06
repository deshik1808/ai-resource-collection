const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { build } = require('../scripts/build');

function tempSrc(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-test-'));
  for (const [name, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), content);
  }
  return dir;
}

test('inlines two files in order and strips module lines', () => {
  const dir = tempSrc({
    'a.js': "const { y } = require('./b')\nfunction x(){}\nmodule.exports = { x }\n",
    'b.js': 'function y(){}\n',
  });
  const out = build("jsCode: __INCLUDE__('a.js','b.js')", dir);
  assert.strictEqual(out, 'jsCode: ' + JSON.stringify('function x(){}\nfunction y(){}'));
});

test('inlines a text file', () => {
  const content = 'Reply with JSON only.\nSecond line "quoted".\n';
  const dir = tempSrc({ 'prompts/p.txt': content });
  const out = build("text: __TEXT__('prompts/p.txt')", dir);
  assert.strictEqual(out, 'text: ' + JSON.stringify(content));
});

test('throws on missing include', () => {
  const dir = tempSrc({});
  assert.throws(() => build("__INCLUDE__('nope.js')", dir), { message: 'include not found: nope.js' });
});

test('a __TEXT__ inside an included file is inlined before the file itself', () => {
  const dir = tempSrc({
    'a.js': "const PROMPT = __TEXT__('prompts/p.txt')\nmodule.exports = { PROMPT }\n",
    'prompts/p.txt': 'Say "hi".\n',
  });
  const out = build("jsCode: __INCLUDE__('a.js')", dir);
  assert.strictEqual(out, 'jsCode: ' + JSON.stringify('const PROMPT = ' + JSON.stringify('Say "hi".\n')));
});

test('__ID__ is replaced from the ids object, also inside included files', () => {
  const dir = tempSrc({ 'a.js': "const MODEL = __ID__('nim_model')\n" });
  const out = build("x: __ID__('sheet_id'), code: __INCLUDE__('a.js')", dir, { sheet_id: 'abc', nim_model: 'm' });
  assert.strictEqual(out, 'x: "abc", code: ' + JSON.stringify('const MODEL = "m"'));
});

test('__ID__ with an unknown key throws', () => {
  assert.throws(() => build("__ID__('nope')", tempSrc({}), {}), { message: 'unknown id: nope' });
});

test('all libs inline together into one valid Code node body', () => {
  const src = path.join(__dirname, '..', 'src');
  const code = JSON.parse(build("__INCLUDE__('lib/input.js', 'lib/reply.js', 'lib/sheet.js', 'lib/resources.js')", src, {}));
  assert.doesNotThrow(() => new Function('$input', '$', code + '\nconst job = 1; const text = 2; return [];'));
});
