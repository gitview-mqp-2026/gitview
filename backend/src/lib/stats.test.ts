import assert from 'node:assert/strict';
import test from 'node:test';
import { memberStats } from './stats.js';

test('memberStats totals commits, lines and PRs per member and skips merges for commits/lines', () => {
  const stats = memberStats({
    members: [
      { userID: 1, name: 'Ada', username: 'ada', email: 'a@x.com' },
      { userID: 2, name: null, username: null, email: 'b@x.com' },
    ],
    commits: [
      { commitHash: 'h1', studentID: 1, isMerge: 0, commitSubject: 'Add thing (#4)', dateTime: '2026-01-02T00:00:00Z' },
      { commitHash: 'h2', studentID: 1, isMerge: 0, commitSubject: 'Fix', dateTime: '2026-01-03T00:00:00Z' },
      { commitHash: 'h3', studentID: 1, isMerge: 1, commitSubject: 'Merge pull request #5 from x/y', dateTime: '2026-01-04T00:00:00Z' },
    ],
    fileChanges: [
      { commitHash: 'h1', additions: 10, deletions: 2 },
      { commitHash: 'h1', additions: 5, deletions: 0 },
      { commitHash: 'h2', additions: 1, deletions: 1 },
      { commitHash: 'h3', additions: 99, deletions: 99 },
    ],
  });
  assert.deepEqual(stats[0], {
    userID: 1, name: 'Ada', username: 'ada', commits: 2, prsMerged: 2, additions: 16, deletions: 3,
    lastCommitAt: '2026-01-04T00:00:00Z',
  });
  assert.equal(stats[1].name, 'b@x.com');
  assert.equal(stats[1].commits, 0);
  assert.equal(stats[1].lastCommitAt, null);
});
