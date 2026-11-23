import { db } from '../prisma/db.js';
import { changedFileChanges } from './fileChangeDiff.js';
import { readGitLog } from './gitLog.js';

// Keeps each IN (...) list well under Postgres's 65,535 bind-parameter limit.
const CHUNK_SIZE = 5000;

function chunks<T>(items: readonly T[]): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK_SIZE) result.push(items.slice(i, i + CHUNK_SIZE));
  return result;
}

export interface RefreshSummary {
  commitsInHistory: number;
  commitsStored: number;
  commitsChanged: number;
  rowsBefore: number;
  rowsAfter: number;
  linesBefore: number;
  linesAfter: number;
  renameRowsBefore: number;
  // After applying: commits whose stored rows still differ from git when re-read from the database. Must be 0.
  remainingDifferences: number;
}

const lines = (rows: readonly { additions: number; deletions: number }[]) =>
  rows.reduce((sum, row) => sum + row.additions + row.deletions, 0);

// Re-reads a repository's history and replaces the stored file changes of commits the app already has, so older
// data picks up the whitespace and rename handling that new ingests get. Ingest itself skips known commits, so
// without this the older rows would stay as they were. Only `fileChange` rows are rewritten: commits, feedback,
// alerts and tags are never touched. Nothing is written unless `apply` is true.
export async function refreshFileChanges(opts: { gitDir: string; apply: boolean }): Promise<RefreshSummary> {
  const parsed = readGitLog(opts.gitDir);

  const known = new Set<string>();
  for (const chunk of chunks(parsed.map((commit) => commit.commitHash))) {
    const rows = await db.orm.public.Commit.where((commit) => commit.commitHash.in(chunk)).select('commitHash').all();
    for (const row of rows) known.add(row.commitHash);
  }

  const stored = (
    await Promise.all(
      chunks([...known]).map((chunk) => db.orm.public.FileChange.where((change) => change.commitHash.in(chunk)).all()),
    )
  ).flat();

  const storedCounts = new Map<string, number>();
  for (const row of stored) storedCounts.set(row.commitHash, (storedCounts.get(row.commitHash) ?? 0) + 1);

  const updates = changedFileChanges(stored, parsed, known);
  const fresh = parsed.filter((commit) => known.has(commit.commitHash)).flatMap((commit) => commit.fileChanges);

  let remainingDifferences = 0;
  if (opts.apply) {
    for (const update of updates) {
      // One transaction per commit, so an interrupted run never leaves a commit with half its files.
      await db.transaction(async (tx) => {
        // .delete() removes a single row; deleteAndCount() removes every match and says how many. The count must
        // equal what we read, otherwise this transaction rolls back rather than leave duplicates behind.
        const removed = await tx.orm.public.FileChange.where({ commitHash: update.commitHash }).deleteAndCount();
        const expected = storedCounts.get(update.commitHash) ?? 0;
        if (removed !== expected) {
          throw new Error(`Expected to replace ${expected} file changes for ${update.commitHash} but removed ${removed}; rolled back.`);
        }
        for (const change of update.changes) {
          await tx.orm.public.FileChange.create({
            commitHash: update.commitHash,
            filePath: change.filePath,
            additions: change.additions,
            deletions: change.deletions,
          });
        }
      });
    }

    // Trust the database, not the plan: re-read what is stored and compare again.
    const reread = (
      await Promise.all(
        chunks([...known]).map((chunk) => db.orm.public.FileChange.where((change) => change.commitHash.in(chunk)).all()),
      )
    ).flat();
    remainingDifferences = changedFileChanges(reread, parsed, known).length;
  }

  return {
    commitsInHistory: parsed.length,
    commitsStored: known.size,
    commitsChanged: updates.length,
    rowsBefore: stored.length,
    rowsAfter: fresh.length,
    linesBefore: lines(stored),
    linesAfter: lines(fresh),
    renameRowsBefore: stored.filter((row) => row.filePath.includes(' => ')).length,
    remainingDifferences,
  };
}
