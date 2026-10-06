const { test } = require('node:test');
const assert = require('node:assert');
const { messageText, splitInput, normalizeUrl, isYouTube } = require('../src/lib/input');

const WATCH = 'https://www.youtube.com/watch?v=abc123';

test('normalizeUrl: Shorts link becomes canonical watch URL without tracking', () => {
  assert.strictEqual(normalizeUrl('https://youtube.com/shorts/abc123?si=XyZ'), WATCH);
});

test('normalizeUrl: youtu.be link becomes canonical watch URL', () => {
  assert.strictEqual(normalizeUrl('https://youtu.be/abc123?si=1'), WATCH);
});

test('normalizeUrl: mobile watch link drops feature param', () => {
  assert.strictEqual(normalizeUrl('https://m.youtube.com/watch?v=abc123&feature=share'), WATCH);
});

test('normalizeUrl: lower-cases host, drops utm, hash and trailing slash', () => {
  assert.strictEqual(
    normalizeUrl('https://GitHub.com/obra/superpowers/?utm_source=x#readme'),
    'https://github.com/obra/superpowers',
  );
});

test('isYouTube: true for Shorts, youtu.be and watch links', () => {
  for (const url of [
    'https://youtube.com/shorts/abc123?si=XyZ',
    'https://youtu.be/abc123?si=1',
    'https://m.youtube.com/watch?v=abc123&feature=share',
  ]) {
    assert.strictEqual(isYouTube(url), true, url);
  }
});

test('isYouTube: false for GitHub and for a YouTube channel page', () => {
  assert.strictEqual(isYouTube('https://github.com/x/y'), false);
  assert.strictEqual(isYouTube('https://www.youtube.com/@somechannel'), false);
});

test('splitInput: returns normalised URLs in order and the remaining note', () => {
  assert.deepStrictEqual(splitInput('from class https://a.com/x and https://b.com'), {
    urls: ['https://a.com/x', 'https://b.com/'],
    note: 'from class and',
  });
});

test('splitInput: keeps at most 5 URLs', () => {
  const text = [1, 2, 3, 4, 5, 6, 7].map((n) => `https://site${n}.com/p`).join(' ');
  assert.strictEqual(splitInput(text).urls.length, 5);
});

test('splitInput: dedupes URLs that normalise to the same address', () => {
  assert.deepStrictEqual(splitInput('https://a.com https://a.com/?utm_source=z').urls, ['https://a.com/']);
});

test('splitInput: trailing sentence punctuation is not part of the URL', () => {
  assert.deepStrictEqual(splitInput('Try this (https://a.com/x).').urls, ['https://a.com/x']);
});

test('messageText: caption plus hidden text_link URL', () => {
  assert.strictEqual(
    messageText({ caption: 'see this', caption_entities: [{ type: 'text_link', url: 'https://x.com/t' }] }),
    'see this https://x.com/t',
  );
});

test('messageText: message with no text is null', () => {
  assert.strictEqual(messageText({ photo: [{}] }), null);
});

const { pageText, domainOf } = require('../src/lib/input');

test('pageText: drops scripts, styles and tags, decodes common entities, collapses space', () => {
  const html = '<html><head><title>Superpowers</title><style>p{color:red}</style><script>alert(1)</script></head>' +
    '<body><h1>Superpowers</h1>\n<p>Skills &amp; workflows for <b>Claude</b>&nbsp;Code</p></body></html>';
  assert.strictEqual(pageText(html, 8000), 'Superpowers Superpowers Skills & workflows for Claude Code');
});

test('pageText: cuts to the limit', () => {
  assert.strictEqual(pageText('<p>' + 'a'.repeat(9000) + '</p>', 8000).length, 8000);
});

test('domainOf: host without www', () => {
  assert.strictEqual(domainOf('https://www.github.com/obra/superpowers'), 'github.com');
  assert.strictEqual(domainOf('not a url'), '');
});
