// Distinct PR numbers, so a merge commit and a squash commit for the same PR count once.
export function countPullRequestsMerged(subjects: string[]): number {
  const numbers = new Set<string>();
  for (const subject of subjects) {
    const m = subject.match(/^Merge pull request #(\d+)/) ?? subject.match(/\(#(\d+)\)\s*$/);
    if (m) numbers.add(m[1]);
  }
  return numbers.size;
}

export interface MemberStatsInput {
  members: readonly { userID: number; name: string | null; username: string | null; email: string }[];
  commits: readonly { commitHash: string; studentID: number; isMerge: number; commitSubject: string; dateTime: unknown }[];
  fileChanges: readonly { commitHash: string; additions: number; deletions: number }[];
}

// Per-member totals. Merge commits are left out of commits and line counts; a merge commit's subject
// still counts toward PRs merged (its author is whoever pressed merge).
export function memberStats({ members, commits, fileChanges }: MemberStatsInput) {
  const lines = new Map<string, { additions: number; deletions: number }>();
  for (const change of fileChanges) {
    const entry = lines.get(change.commitHash) ?? { additions: 0, deletions: 0 };
    entry.additions += change.additions;
    entry.deletions += change.deletions;
    lines.set(change.commitHash, entry);
  }

  return members.map((member) => {
    const own = commits.filter((c) => c.studentID === member.userID);
    const authored = own.filter((c) => !c.isMerge);
    let additions = 0;
    let deletions = 0;
    for (const c of authored) {
      additions += lines.get(c.commitHash)?.additions ?? 0;
      deletions += lines.get(c.commitHash)?.deletions ?? 0;
    }
    const lastCommitAt = own.reduce<unknown>(
      (latest, c) => (latest === null || String(c.dateTime) > String(latest) ? c.dateTime : latest),
      null,
    );
    return {
      userID: member.userID,
      name: member.name ?? member.username ?? member.email,
      username: member.username,
      commits: authored.length,
      prsMerged: countPullRequestsMerged(own.map((c) => c.commitSubject)),
      additions,
      deletions,
      lastCommitAt,
    };
  });
}
