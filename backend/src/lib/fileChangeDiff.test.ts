import assert from 'node:assert/strict';
import test from 'node:test';
import { changedFileChanges } from './fileChangeDiff.js';
import type { ParsedCommit } from './gitLog.js';

const commit = (hash: string, fileChanges: ParsedCommit['fileChanges']): ParsedCommit => ({
  commitHash: hash,
  parentHashes: [],
  author: 'a',
  authorEmail: 'a@example.com',
  committer: 'a',
  committedAtMs: 0,
  refs: '',
  subject: 's',
  body: '',
  fileChanges,
});

const row = (commitHash: string, filePath: string, additions: number, deletions: number) => ({
  commitHash, filePath, additions, deletions,
});

test('commits whose stored rows already match are left alone, in any order', () => {
  const updates = changedFileChanges(
    [row('a', 'x.js', 3, 1), row('a', 'y.js', 2, 0)],
    [commit('a', [{ filePath: 'y.js', additions: 2, deletions: 0 }, { filePath: 'x.js', additions: 3, deletions: 1 }])],
    new Set(['a']),
  );
  assert.deepEqual(updates, []);
});

test('a stored rename path or changed count is reported with the fresh rows', () => {
  const fresh = [{ filePath: 'app/templates/base.html', additions: 21, deletions: 1 }];
  const updates = changedFileChanges(
    [row('a', 'app/{auth => }/templates/base.html', 21, 1), row('b', 'k.js', 10, 4)],
    [commit('a', fresh), commit('b', [{ filePath: 'k.js', additions: 8, deletions: 4 }])],
    new Set(['a', 'b']),
  );
  assert.deepEqual(updates.map((u) => u.commitHash), ['a', 'b']);
  assert.deepEqual(updates[0].changes, fresh);
});

test('a commit whose fresh list is empty still updates, clearing stale rows', () => {
  const updates = changedFileChanges([row('a', 'a.js', 0, 0)], [commit('a', [])], new Set(['a']));
  assert.deepEqual(updates, [{ commitHash: 'a', changes: [] }]);
});

test('commits the app never stored are never added', () => {
  const updates = changedFileChanges([], [commit('bot', [{ filePath: 'x', additions: 1, deletions: 0 }])], new Set(['a']));
  assert.deepEqual(updates, []);
});

test('a stored commit with no rows and no fresh rows needs no update', () => {
  assert.deepEqual(changedFileChanges([], [commit('merge', [])], new Set(['merge'])), []);
});

test('a duplicated stored row counts as a difference', () => {
  const updates = changedFileChanges(
    [row('a', 'x.js', 1, 1), row('a', 'x.js', 1, 1)],
    [commit('a', [{ filePath: 'x.js', additions: 1, deletions: 1 }])],
    new Set(['a']),
  );
  assert.equal(updates.length, 1);
});
