const { test } = require('node:test');
const assert = require('node:assert');
const { toRow, holdRow, findDuplicate, planJobs, nextRetryState } = require('../src/lib/sheet');

const NOW = new Date('2026-10-06T09:02:00Z');
const SHORT = 'https://youtube.com/shorts/abc123?si=x';
const SHORT_CANON = 'https://www.youtube.com/watch?v=abc123';

function row(fields) {
  return {
    saved_at: '2026-09-12 10:00', name: '', category: '', description: '', link: '', link_from: '',
    prompt_text: '', source_url: '', note: '', status: 'ok', attempts: 0, row_number: 2, ...fields,
  };
}

const skill = { name: 'superpowers', category: 'Skill', description: 'Workflows', link_in_source: '', prompt_text: '' };

test('toRow: saved_at is IST to the minute, status ok, attempts 0', () => {
  const r = toRow(skill, { link: 'https://skills.sh/obra/superpowers', link_from: 'skills.sh', source_url: SHORT_CANON, note: 'from class', now: NOW });
  assert.strictEqual(r.saved_at, '2026-10-06 14:32');
  assert.strictEqual(r.status, 'ok');
  assert.strictEqual(r.attempts, 0);
  assert.strictEqual(r.link_from, 'skills.sh');
  assert.strictEqual(r.name, 'superpowers');
});

test('holdRow: empty category, name defaults to empty, keeps source and note', () => {
  const r = holdRow({ source_url: SHORT_CANON, note: 'n', status: 'pending', now: NOW });
  assert.strictEqual(r.name, '');
  assert.strictEqual(r.category, '');
  assert.strictEqual(r.status, 'pending');
  assert.strictEqual(r.source_url, SHORT_CANON);
  assert.strictEqual(r.note, 'n');
  assert.strictEqual(holdRow({ source_url: 'https://a.com/', note: '', status: 'check', now: NOW, name: 'a.com' }).name, 'a.com');
});

test('findDuplicate: same link with different case and tracking is a duplicate', () => {
  const existing = row({ name: 'Other', category: 'Tool', link: 'https://github.com/obra/superpowers' });
  assert.strictEqual(findDuplicate(skill, 'https://GitHub.com/obra/superpowers/?utm_source=x', [existing]), existing);
});

test('findDuplicate: same name and category with a different link is a duplicate', () => {
  const existing = row({ name: 'SuperPowers', category: 'Skill', link: 'https://github.com/obra/superpowers' });
  assert.strictEqual(findDuplicate(skill, 'https://skills.sh/obra/superpowers', [existing]), existing);
});

test('findDuplicate: same name in a different category is not a duplicate', () => {
  const existing = row({ name: 'superpowers', category: 'Tool', link: 'https://x.com' });
  assert.strictEqual(findDuplicate(skill, '', [existing]), null);
});

test('findDuplicate: rows that are not ok are ignored', () => {
  const existing = row({ name: 'superpowers', category: 'Skill', status: 'check' });
  assert.strictEqual(findDuplicate(skill, '', [existing]), null);
});

test('planJobs: URL already saved gives a notice and no job', () => {
  const rows = [row({ source_url: SHORT_CANON, status: 'ok', saved_at: '2026-09-12 10:00' })];
  const out = planJobs({ chat_id: '1', text: SHORT, retry_row: null }, rows);
  assert.strictEqual(out.jobs.length, 0);
  assert.deepStrictEqual(out.notices, ['Already saved on 2026-09-12']);
});

test('planJobs: URL already pending gives the queued notice', () => {
  const rows = [row({ source_url: SHORT_CANON, status: 'pending' })];
  const out = planJobs({ chat_id: '1', text: SHORT, retry_row: null }, rows);
  assert.strictEqual(out.jobs.length, 0);
  assert.deepStrictEqual(out.notices, ['Already queued, will retry']);
});

test('planJobs: URL in a check row is processed again with replace_row', () => {
  const rows = [row({ source_url: SHORT_CANON, status: 'check', row_number: 7 })];
  const out = planJobs({ chat_id: '1', text: `${SHORT} skill at 0:30`, retry_row: null }, rows);
  assert.strictEqual(out.jobs.length, 1);
  assert.deepStrictEqual(out.jobs[0], {
    chat_id: '1', kind: 'youtube', source_url: SHORT_CANON, note: 'skill at 0:30',
    text: `${SHORT} skill at 0:30`, retry_row: null, replace_row: 7,
  });
});

test('planJobs: a non-YouTube link is a page job', () => {
  const out = planJobs({ chat_id: '1', text: 'https://github.com/obra/superpowers', retry_row: null }, []);
  assert.strictEqual(out.jobs[0].kind, 'page');
  assert.strictEqual(out.jobs[0].source_url, 'https://github.com/obra/superpowers');
});

test('planJobs: text without a URL is one text job', () => {
  const out = planJobs({ chat_id: '1', text: 'superpowers skill', retry_row: null }, []);
  assert.strictEqual(out.jobs.length, 1);
  assert.strictEqual(out.jobs[0].kind, 'text');
  assert.strictEqual(out.jobs[0].text, 'superpowers skill');
  assert.strictEqual(out.jobs[0].source_url, '');
});

test('planJobs: retry_row skips the already-saved lookup', () => {
  const rows = [row({ source_url: SHORT_CANON, status: 'ok' })];
  const out = planJobs({ chat_id: '1', text: `${SHORT} note`, retry_row: 4 }, rows);
  assert.strictEqual(out.jobs.length, 1);
  assert.strictEqual(out.jobs[0].retry_row, 4);
  assert.strictEqual(out.jobs[0].kind, 'youtube');
  assert.deepStrictEqual(out.notices, []);
});

test('nextRetryState: counts attempts and gives up after 3', () => {
  assert.deepStrictEqual(nextRetryState({ attempts: 1 }), { status: 'pending', attempts: 2 });
  assert.deepStrictEqual(nextRetryState({ attempts: 2 }), { status: 'check', attempts: 3 });
});

test('nextRetryState: reads attempts stored as text by Google Sheets', () => {
  assert.deepStrictEqual(nextRetryState({ attempts: '' }), { status: 'pending', attempts: 1 });
  assert.deepStrictEqual(nextRetryState({ attempts: '2' }), { status: 'check', attempts: 3 });
});
