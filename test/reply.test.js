const { test } = require('node:test');
const assert = require('node:assert');
const { ICONS, formatSummary, findRows, formatFind } = require('../src/lib/reply');

function row(fields) {
  return {
    saved_at: '2026-10-06 14:32', name: 'X', category: 'Tool', description: '', link: '', link_from: '',
    prompt_text: '', source_url: '', note: '', status: 'ok', attempts: 0, ...fields,
  };
}

test('ICONS: one icon per category', () => {
  assert.deepStrictEqual(ICONS, { Skill: '🧩', Tool: '🔧', Prompt: '💬', Website: '🌐' });
});

test('formatSummary: spec example lines, with full tappable links', () => {
  const saved = [
    row({ name: 'superpowers', category: 'Skill', description: 'brainstorming + TDD workflows for Claude Code', link: 'https://skills.sh/obra/superpowers', link_from: 'skills.sh' }),
    row({ name: 'NotebookLM', category: 'Tool', description: 'chat with your PDFs', link: 'https://notebooklm.google', link_from: 'search' }),
    row({ name: 'XYZ', category: 'Tool', description: '', link: '', link_from: 'not found' }),
  ];
  assert.strictEqual(
    formatSummary(saved, [], [], 'Short'),
    [
      '✅ 3 found in this Short',
      '🧩 Skill · superpowers — brainstorming + TDD workflows for Claude Code · https://skills.sh/obra/superpowers',
      '🔧 Tool · NotebookLM — chat with your PDFs · https://notebooklm.google 🔎',
      '🔧 Tool · XYZ — ❓ link not found',
    ].join('\n'),
  );
});

test('formatSummary: a prompt shows exactly its first 100 characters', () => {
  const prompt = 'p'.repeat(100) + 'Q'.repeat(5900);
  const out = formatSummary([row({ name: 'Long prompt', category: 'Prompt', prompt_text: prompt })], [], [], 'message');
  const line = out.split('\n')[1];
  assert.ok(line.includes('p'.repeat(100)));
  assert.ok(!line.includes('Q'));
});

test('formatSummary: skipped duplicates and notices are listed', () => {
  const out = formatSummary([], ['superpowers'], ['Already saved on 2026-09-12'], 'Short');
  assert.strictEqual(out, ['✅ 1 found in this Short', 'superpowers — already saved', 'Already saved on 2026-09-12'].join('\n'));
});

test('formatSummary: notices alone are sent without a header', () => {
  assert.strictEqual(formatSummary([], [], ['Already queued, will retry'], 'Short'), 'Already queued, will retry');
});

test('formatSummary: nothing at all', () => {
  assert.strictEqual(formatSummary([], [], [], 'Short'), 'Nothing found in this one');
});

test('formatSummary: 60 rows fit Telegram and count the rest', () => {
  const saved = Array.from({ length: 60 }, (_, i) =>
    row({ name: `Tool number ${i}`, description: 'd'.repeat(80), link: `https://example.com/tool/${i}`, link_from: 'search' }));
  const out = formatSummary(saved, [], ['⏸ Saved for later, will retry'], 'Short');
  assert.ok(out.length <= 4096, `length ${out.length}`);
  const shown = out.split('\n').filter((l) => l.startsWith('🔧')).length;
  assert.ok(out.includes(`…and ${60 - shown} more in the Sheet.`));
  assert.ok(out.endsWith('⏸ Saved for later, will retry'), 'notices are never cut');
});

test('findRows: every word must match, ok rows only, newest first, top 10', () => {
  const rows = [];
  for (let i = 0; i < 14; i++) {
    rows.push(row({ name: `PDF tool ${i}`, category: 'Skill', saved_at: `2026-10-${String(i + 1).padStart(2, '0')} 10:00` }));
  }
  rows.push(row({ name: 'PDF reader', category: 'Tool' }));
  rows.push(row({ name: 'Skill without the word', category: 'Skill' }));
  rows.push(row({ name: 'PDF skill pending', category: 'Skill', status: 'pending' }));
  const result = findRows(rows, 'skill pdf');
  assert.strictEqual(result.rows.length, 10);
  assert.strictEqual(result.more, 4);
  assert.strictEqual(result.rows[0].name, 'PDF tool 13');
  assert.ok(result.rows.every((r) => r.category === 'Skill' && r.status === 'ok'));
});

test('formatFind: lines with links or prompt preview, plus the more line', () => {
  const out = formatFind('pdf', {
    rows: [
      row({ name: 'NotebookLM', link: 'https://notebooklm.google' }),
      row({ name: 'Summarise', category: 'Prompt', prompt_text: 'Summarise this PDF in five bullets' }),
    ],
    more: 3,
  });
  assert.strictEqual(out, [
    '🔧 NotebookLM — https://notebooklm.google',
    '💬 Summarise — Summarise this PDF in five bullets',
    '…and 3 more. Add a word or open the Sheet.',
  ].join('\n'));
});

test('formatFind: no match', () => {
  assert.strictEqual(formatFind('zzz', { rows: [], more: 0 }), 'Nothing for "zzz".');
});
