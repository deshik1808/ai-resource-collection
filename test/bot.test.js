const { test } = require('node:test');
const assert = require('node:assert');
const { route } = require('../src/lib/bot');

const msg = (fields, from = 42) => ({ message: { chat: { id: from }, ...fields } });

test('route: a stranger is ignored', () => {
  assert.strictEqual(route(msg({ text: 'hi' }, 7), '42').action, 'ignore');
});

test('route: before setup only /start answers, and shows the chat id', () => {
  assert.deepStrictEqual(route(msg({ text: '/start' }), ''), { action: 'start', chat_id: '42', text: '/start', query: '', show_chat_id: true });
  assert.strictEqual(route(msg({ text: 'https://youtu.be/x' }), '').action, 'ignore');
});

test('route: /find with words, and bare /find', () => {
  const found = route(msg({ text: '/find skill pdf' }), '42');
  assert.strictEqual(found.action, 'find');
  assert.strictEqual(found.query, 'skill pdf');
  assert.strictEqual(route(msg({ text: '/find' }), '42').query, '');
  assert.strictEqual(route(msg({ text: '/find@AIBasketBot rag' }), '42').query, 'rag');
});

test('route: photo without caption is unsupported; link or text is saved', () => {
  assert.strictEqual(route(msg({ photo: [{}] }), '42').action, 'unsupported');
  const saved = route(msg({ text: 'see https://x.com/t' }), '42');
  assert.strictEqual(saved.action, 'save');
  assert.strictEqual(saved.text, 'see https://x.com/t');
  assert.strictEqual(saved.show_chat_id, false);
});

test('route: an update without a message is ignored', () => {
  assert.strictEqual(route({ edited_message: {} }, '42').action, 'ignore');
});
