import type { ParsedCommit, ParsedFileChange } from './gitLog.js';

export interface StoredFileChange {
  commitHash: string;
  filePath: string;
  additions: number;
  deletions: number;
}

export interface FileChangeUpdate {
  commitHash: string;
  changes: ParsedFileChange[];
}

const keyOf = (change: ParsedFileChange) => `${change.additions}\t${change.deletions}\t${change.filePath}`;

function sameChanges(a: readonly ParsedFileChange[], b: readonly ParsedFileChange[]): boolean {
  if (a.length !== b.length) return false;
  const left = a.map(keyOf).sort();
  const right = b.map(keyOf).sort();
  return left.every((key, index) => key === right[index]);
}

// Commits already stored whose file changes differ from what git reports now. Only commits in `knownHashes` are
// considered, so a commit the app never stored (a bot's, say) is never added here. A commit whose fresh list is
// empty is included too: its stored rows are now stale, for example after whitespace-only edits stop counting.
export function changedFileChanges(
  stored: readonly StoredFileChange[],
  parsed: readonly ParsedCommit[],
  knownHashes: ReadonlySet<string>,
): FileChangeUpdate[] {
  const storedByHash = new Map<string, ParsedFileChange[]>();
  for (const row of stored) {
    const rows = storedByHash.get(row.commitHash) ?? [];
    rows.push({ filePath: row.filePath, additions: row.additions, deletions: row.deletions });
    storedByHash.set(row.commitHash, rows);
  }

  const updates: FileChangeUpdate[] = [];
  for (const commit of parsed) {
    if (!knownHashes.has(commit.commitHash)) continue;
    if (!sameChanges(storedByHash.get(commit.commitHash) ?? [], commit.fileChanges)) {
      updates.push({ commitHash: commit.commitHash, changes: commit.fileChanges });
    }
  }
  return updates;
}
