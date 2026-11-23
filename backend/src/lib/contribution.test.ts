import assert from 'node:assert/strict';
import test from 'node:test';
import {
  contributionDetail,
  contributionIndex,
  contributionSummary,
  DEFAULT_WEIGHTS,
  effectiveLines,
  isExcludedPath,
  labelingCoverage,
  levelFor,
} from './contribution.js';
import { categoryResolver } from './fileLabels.js';

// Directory labels keep fixtures short: db/ is Database, test/ is Testing, ui/ is Templates/Components.
const resolve = categoryResolver([], [
  { path: 'db', category: 'Database' },
  { path: 'test', category: 'Testing' },
  { path: 'ui', category: 'Templates/Components' },
]);

let counter = 0;
// One commit by `studentID` touching the given files; returns rows ready for contributionIndex.
function commit(studentID: number, files: [path: string, additions: number, deletions?: number][], isMerge = 0) {
  const commitHash = String(++counter).padStart(40, '0');
  return {
    commit: { commitHash, studentID, isMerge },
    changes: files.map(([filePath, additions, deletions = 0]) => ({ commitHash, filePath, additions, deletions })),
  };
}

function build(rows: ReturnType<typeof commit>[], members: number[], weights?: Parameters<typeof contributionIndex>[0]['weights']) {
  return contributionIndex({
    members: members.map((userID) => ({ userID })),
    commits: rows.map((row) => row.commit),
    fileChanges: rows.flatMap((row) => row.changes),
    resolve,
    weights,
  });
}

test('effectiveLines weights deletions at half and damps very large changes', () => {
  assert.equal(effectiveLines(100, 40), 120);
  assert.equal(effectiveLines(0, 10), 5);
  assert.equal(effectiveLines(200, 0), 200);
  assert.equal(effectiveLines(3000, 0), 900); // 200 + 25% of the remaining 2800
});

test('levelFor uses the green and yellow thresholds inclusively', () => {
  assert.equal(levelFor(1.25), 'green');
  assert.equal(levelFor(0.85), 'green');
  assert.equal(levelFor(0.84), 'yellow');
  assert.equal(levelFor(0.6), 'yellow');
  assert.equal(levelFor(0.59), 'red');
  assert.equal(levelFor(0), 'red');
});

test('default weights total 100 percent', () => {
  assert.equal(Object.values(DEFAULT_WEIGHTS).reduce((sum, percent) => sum + percent, 0), 100);
});

test('isExcludedPath skips lockfiles, build output, vendored and minified files', () => {
  for (const path of ['package-lock.json', 'frontend/package-lock.json', 'node_modules/x/index.js', 'a/dist/app.js', 'x.min.js', 'app.js.map']) {
    assert.equal(isExcludedPath(path), true, path);
  }
  for (const path of ['src/app.js', 'distance/calc.ts', 'docs/build-notes.md']) assert.equal(isExcludedPath(path), false, path);
});

test('an equal split gives everyone exactly 1.00 and green', () => {
  const result = build(
    [commit(1, [['db/a.sql', 100]]), commit(2, [['db/b.sql', 100]]), commit(3, [['db/c.sql', 100]])],
    [1, 2, 3],
  );
  for (const userID of [1, 2, 3]) {
    const member = result.members.get(userID)!;
    assert.equal(member.index, 1);
    assert.equal(member.level, 'green');
    assert.equal(member.reason, null);
  }
});

test('a category index is capped at 1.25 so extra work cannot hide a gap', () => {
  const result = build([commit(1, [['db/a.sql', 180]]), commit(2, [['db/b.sql', 20]])], [1, 2]);
  const heavy = result.members.get(1)!;
  const light = result.members.get(2)!;
  assert.equal(heavy.categories.find((c) => c.category === 'Database')!.index, 1.25); // uncapped would be 1.8
  assert.equal(heavy.index, 1.25);
  assert.equal(light.index, 0.2);
  assert.equal(light.level, 'red');
});

test('categories nobody worked in are dropped and the rest are rescaled to 100 percent', () => {
  // Only Database (25) and Testing (10) have activity, so their weights become 25/35 and 10/35.
  const result = build([commit(1, [['db/a.sql', 100]]), commit(2, [['test/a.test.ts', 100]])], [1, 2]);
  const a = result.members.get(1)!;
  assert.equal(a.index, 0.89); // 25/35 × 1.25
  assert.equal(result.members.get(2)!.index, 0.36); // 10/35 × 1.25
  assert.equal(a.categories.filter((c) => c.included).length, 2);
  assert.equal(a.categories.find((c) => c.category === 'Styling')!.included, false);

  const effective = Object.fromEntries(a.categories.map((c) => [c.category, Math.round(c.effectiveWeight * 100) / 100]));
  assert.equal(effective.Database, 71.43);
  assert.equal(effective.Testing, 28.57);
  assert.equal(effective.Styling, 0);
  assert.equal(Math.round(a.categories.reduce((sum, c) => sum + c.effectiveWeight, 0)), 100);
});

test('a category with weight 0 does not count', () => {
  const result = build(
    [commit(1, [['db/a.sql', 100]]), commit(2, [['test/a.test.ts', 100]])],
    [1, 2],
    { Database: 0, Testing: 100 },
  );
  assert.equal(result.members.get(1)!.index, 0);
  assert.equal(result.members.get(2)!.index, 1.25);
});

test('lockfiles, merge commits and non-member authors do not count', () => {
  const clean = build([commit(1, [['db/a.sql', 100]]), commit(2, [['db/b.sql', 100]])], [1, 2]);
  const noisy = build(
    [
      commit(1, [['db/a.sql', 100], ['package-lock.json', 5000]]),
      commit(2, [['db/b.sql', 100]]),
      commit(2, [['db/merged.sql', 9999]], 1),
      commit(99, [['db/outsider.sql', 9999]]),
    ],
    [1, 2],
  );
  assert.equal(noisy.members.get(1)!.index, clean.members.get(1)!.index);
  assert.equal(noisy.members.get(2)!.index, 1);
  assert.deepEqual(noisy.coverage, clean.coverage);
});

test('a huge pasted file is damped, not counted line for line', () => {
  // 3000 lines in one file damp to 900, the same as 900 lines written across five normal-sized files.
  const result = build(
    [
      commit(1, [['db/paste.sql', 3000]]),
      commit(2, [['db/a.sql', 200], ['db/b.sql', 200], ['db/c.sql', 200], ['db/d.sql', 200], ['db/e.sql', 100]]),
    ],
    [1, 2],
  );
  assert.equal(result.members.get(1)!.index, 1);
  assert.equal(result.members.get(2)!.index, 1);
});

test('a member with no commits on a team that did real work is red, not gray', () => {
  const result = build([commit(1, [['db/a.sql', 150]]), commit(2, [['db/b.sql', 150]])], [1, 2, 3]);
  const idle = result.members.get(3)!;
  assert.equal(idle.index, 0);
  assert.equal(idle.level, 'red');
  assert.equal(idle.reason, null);
});

test('a team with very little labeled work is gray for everyone', () => {
  const result = build([commit(1, [['db/a.sql', 30]]), commit(2, [['db/b.sql', 30]])], [1, 2]);
  for (const member of result.members.values()) {
    assert.equal(member.level, 'gray');
    assert.equal(member.reason, 'low-data');
    assert.equal(member.index, 1); // the number is still available, only the color is withheld
  }
});

test('low labeling coverage turns every score gray', () => {
  const result = build(
    [
      commit(1, [['db/a.sql', 100], ['misc/x.txt', 100], ['misc/y.txt', 100], ['misc/z.txt', 100]]),
      commit(2, [['db/b.sql', 100]]),
    ],
    [1, 2],
  );
  assert.equal(result.coverage.ratio, 0.4); // 200 of 500 effective lines are labeled
  for (const member of result.members.values()) {
    assert.equal(member.level, 'gray');
    assert.equal(member.reason, 'low-coverage');
  }
});

test('unlabeled files are left out of scores', () => {
  const result = build(
    [commit(1, [['db/a.sql', 100], ['misc/x.txt', 20]]), commit(2, [['db/b.sql', 100]])],
    [1, 2],
  );
  assert.equal(result.members.get(1)!.index, 1);
  assert.equal(result.members.get(1)!.level, 'green');
});

test('a team with no labeled work has no index at all', () => {
  const result = build([commit(1, [['misc/x.txt', 500]]), commit(2, [['misc/y.txt', 500]])], [1, 2]);
  for (const member of result.members.values()) {
    assert.equal(member.index, null);
    assert.equal(member.level, 'gray');
    assert.equal(member.reason, 'no-labeled-work');
  }
});

test('labelingCoverage reports full coverage for an empty repository', () => {
  assert.deepEqual(labelingCoverage({ commits: [], fileChanges: [], resolve }), { labeledLines: 0, totalLines: 0, ratio: 1 });
});

test('contributionSummary and contributionDetail shape one member for the API without leaking coverage', () => {
  const result = build([commit(1, [['db/a.sql', 100]]), commit(2, [['test/a.test.ts', 100]])], [1, 2]);
  const member = result.members.get(1);

  assert.deepEqual(contributionSummary(member), { index: 0.89, level: 'green', reason: null });
  const detail = contributionDetail(member)!;
  assert.equal(detail.index, 0.89);
  assert.equal(detail.categories.length, 7);
  assert.deepEqual(detail.categories.find((c) => c.category === 'Database'), {
    category: 'Database',
    weight: 25,
    effectiveWeight: 71.43,
    included: true,
    share: 1,
    index: 1.25,
  });
  assert.equal(detail.categories.find((c) => c.category === 'Styling')!.included, false);
  assert.equal('coverage' in detail, false);
  assert.equal(contributionSummary(undefined), null);
  assert.equal(contributionDetail(undefined), null);
});
