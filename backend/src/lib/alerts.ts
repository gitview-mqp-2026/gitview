const DAY_MS = 24 * 60 * 60 * 1000;
export const INACTIVITY_DAYS = 7;

interface StudentRow {
  userID: number;
}

interface CommitRow {
  commitHash: string;
  studentID: number;
  dateTime: { epochMilliseconds: number };
  isMerge: number;
}

export type TeamAlert =
  | {
      type: 'inactivity';
      studentID: number;
      commitHash: string;
      daysInactive: number;
      message: string;
    }
  | {
      type: 'deadline';
      studentID: number;
      commitHash: string;
      commitCount: number;
      mergeCount: number;
      message: string;
    };

export function buildTeamAlerts(
  students: StudentRow[],
  commits: CommitRow[],
  nowMs = Date.now(),
): TeamAlert[] {
  const commitsByStudent = new Map<number, CommitRow[]>();
  for (const commit of commits) {
    const studentCommits = commitsByStudent.get(commit.studentID) ?? [];
    studentCommits.push(commit);
    commitsByStudent.set(commit.studentID, studentCommits);
  }

  const alerts: TeamAlert[] = [];
  for (const student of students) {
    const studentCommits = commitsByStudent.get(student.userID) ?? [];
    if (studentCommits.length === 0) continue;

    const latest = studentCommits.reduce((newest, commit) =>
      commit.dateTime.epochMilliseconds > newest.dateTime.epochMilliseconds ? commit : newest
    );
    const daysInactive = Math.floor((nowMs - latest.dateTime.epochMilliseconds) / DAY_MS);
    if (daysInactive >= INACTIVITY_DAYS) {
      alerts.push({
        type: 'inactivity',
        studentID: student.userID,
        commitHash: latest.commitHash,
        daysInactive,
        message: `Student ${student.userID} - no commits in ${daysInactive} days`,
      });
    }

    // shortcut: Monday means UTC and covers stored history, use the course deadline and timezone when configurable.
    const deadlineCommits = studentCommits.filter(
      (commit) => new Date(commit.dateTime.epochMilliseconds).getUTCDay() === 1,
    );
    if (deadlineCommits.length === 0) continue;

    const latestDeadlineCommit = deadlineCommits.reduce((newest, commit) =>
      commit.dateTime.epochMilliseconds > newest.dateTime.epochMilliseconds ? commit : newest
    );
    const mergeCount = deadlineCommits.filter((commit) => commit.isMerge > 0).length;
    const commitWord = deadlineCommits.length === 1 ? 'commit' : 'commits';
    const mergeDetail = mergeCount === 0
      ? ''
      : `, including ${mergeCount} ${mergeCount === 1 ? 'merge' : 'merges'}`;
    alerts.push({
      type: 'deadline',
      studentID: student.userID,
      commitHash: latestDeadlineCommit.commitHash,
      commitCount: deadlineCommits.length,
      mergeCount,
      message: `Student ${student.userID} - ${deadlineCommits.length} ${commitWord} made on Monday deadlines${mergeDetail}`,
    });
  }

  return alerts;
}
