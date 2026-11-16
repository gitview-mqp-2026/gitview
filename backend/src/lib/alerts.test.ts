import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTeamAlerts, INACTIVITY_DAYS } from './alerts.js';

const instant = (value: string) => ({ epochMilliseconds: Date.parse(value) });

test('buildTeamAlerts derives inactivity and Monday deadline activity from commit timestamps', () => {
  const alerts = buildTeamAlerts(
    [{ userID: 1 }, { userID: 2 }, { userID: 3 }, { userID: 4 }],
    [
      { commitHash: 'old', studentID: 1, dateTime: instant('2026-11-03T12:00:00Z'), isMerge: 0 },
      { commitHash: 'merge', studentID: 2, dateTime: instant('2026-11-09T20:00:00Z'), isMerge: 1 },
      { commitHash: 'commit', studentID: 2, dateTime: instant('2026-11-09T12:00:00Z'), isMerge: 0 },
      { commitHash: 'sunday', studentID: 3, dateTime: instant('2026-11-08T12:00:00Z'), isMerge: 0 },
    ],
    Date.parse('2026-11-10T12:00:00Z'),
  );

  assert.equal(INACTIVITY_DAYS, 7);
  assert.deepEqual(alerts, [
    {
      type: 'inactivity',
      studentID: 1,
      commitHash: 'old',
      daysInactive: 7,
      message: 'Student 1 - no commits in 7 days',
    },
    {
      type: 'deadline',
      studentID: 2,
      commitHash: 'merge',
      commitCount: 2,
      mergeCount: 1,
      message: 'Student 2 - 2 commits made on Monday deadlines, including 1 merge',
    },
  ]);
});

test('buildTeamAlerts ignores future timestamps, sub-threshold inactivity, and members without commits', () => {
  const alerts = buildTeamAlerts(
    [{ userID: 1 }, { userID: 2 }, { userID: 3 }],
    [
      { commitHash: 'recent', studentID: 1, dateTime: instant('2026-11-03T12:00:01Z'), isMerge: 0 },
      { commitHash: 'future', studentID: 2, dateTime: instant('2026-11-11T12:00:00Z'), isMerge: 0 },
    ],
    Date.parse('2026-11-10T12:00:00Z'),
  );

  assert.deepEqual(alerts, []);
});
