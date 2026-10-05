// Distinct PR numbers, so a merge commit and a squash commit for the same PR count once.
export function countPullRequestsMerged(subjects: string[]): number {
  const numbers = new Set<string>();
  for (const subject of subjects) {
    const m = subject.match(/^Merge pull request #(\d+)/) ?? subject.match(/\(#(\d+)\)\s*$/);
    if (m) numbers.add(m[1]);
  }
  return numbers.size;
}
