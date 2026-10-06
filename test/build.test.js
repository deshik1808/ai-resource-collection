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
