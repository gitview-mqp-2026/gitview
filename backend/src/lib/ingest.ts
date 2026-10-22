import { execFileSync } from 'child_process';
import { Temporal } from 'temporal-polyfill';
import { db } from '../prisma/db.js';

interface ParsedFileChange {
  filePath: string;
  additions: number;
  deletions: number;
}

interface ParsedCommit {
  commitHash: string;
  parentHashes: string[];
  author: string;
  authorEmail: string;
  committer: string;
  committedAtMs: number;
  refs: string;
  subject: string;
  body: string;
  fileChanges: ParsedFileChange[];
}

export interface IngestResult {
  teamID: number;
  parsed: number;
  ingested: number;
  alreadyPresent: number;
}

const COMMIT_MARK = '--GITVIEW-COMMIT--';
const BODY_START = '--GITVIEW-BODY--';
const BODY_END = '--GITVIEW-BODY-END--';

export function parseGitLog(cwd: string, maxCommits?: number): ParsedCommit[] {
  // Fixed-position header lines, then a marker-delimited body (it can span lines), then --numstat rows.
  const raw = execFileSync(
    'git',
    [
      'log',
      ...(maxCommits ? [`--max-count=${maxCommits}`] : []),
      `--pretty=format:${COMMIT_MARK}%n%H%n%P%n%an%n%ae%n%at%n%cn%n%D%n%s%n${BODY_START}%n%b%n${BODY_END}`,
      '--numstat',
    ],
    { cwd, encoding: 'utf-8', maxBuffer: 200 * 1024 * 1024 }
  );

  return raw
    .split(`${COMMIT_MARK}\n`)
    .filter(Boolean)
    .flatMap((block): ParsedCommit[] => {
      const lines = block.split('\n');
      const commitHash = lines[0]?.trim() ?? '';
      if (commitHash.length !== 40 || lines[8]?.trim() !== BODY_START) return [];

      const bodyEnd = lines.indexOf(BODY_END, 9);
      if (bodyEnd === -1) return [];

      const fileChanges: ParsedFileChange[] = [];
      for (let i = bodyEnd + 1; i < lines.length; i++) {
        const match = lines[i].trim().match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
        if (match) {
          fileChanges.push({
            filePath: match[3],
            additions: match[1] === '-' ? 0 : parseInt(match[1], 10),
            deletions: match[2] === '-' ? 0 : parseInt(match[2], 10),
          });
        }
      }

      return [
        {
          commitHash,
          parentHashes: (lines[1] ?? '').trim().split(/\s+/).filter(Boolean),
          author: lines[2].trim(),
          authorEmail: lines[3].trim().toLowerCase(),
          committedAtMs: parseInt(lines[4].trim(), 10) * 1000,
          committer: lines[5].trim(),
          refs: lines[6].trim(),
          subject: lines[7].trim(),
          body: lines.slice(9, bodyEnd).join('\n').trim(),
          fileChanges,
        },
      ];
    });
}

export async function ingestRepo(opts: {
  path: string;
  name: string;
  url: string;
  maxCommits?: number;
}): Promise<IngestResult> {
  const commits = parseGitLog(opts.path, opts.maxCommits);

  // Repository has no path column, so the URL is its identity.
  let repo = await db.orm.public.Repository.where({ url: opts.url }).first();
  if (!repo) {
    repo = await db.orm.public.Repository.create({ url: opts.url, name: opts.name });
  }
  const teamID = repo.teamID;

  // Every Commit needs a Student, and every Student needs a User, so build both from commit authors.
  const studentIdByEmail = new Map<string, number>();
  async function studentIdFor(email: string, name: string): Promise<number> {
    const key = email || `${name}@unknown`;
    const cached = studentIdByEmail.get(key);
    if (cached !== undefined) return cached;

    let user = await db.orm.public.User.where({ email: key }).first();
    let student = user ? await db.orm.public.Student.where({ userID: user.userID }).first() : null;

    // Student.userID is the primary key, so a user can be on only one team. When this author is
    // already on another team, give them a per-team identity rather than moving their commits.
    if (user && student && student.teamID !== teamID) {
      const scoped = `${key}#team${teamID}`;
      user = (await db.orm.public.User.where({ email: scoped }).first())
        ?? (await db.orm.public.User.create({ email: scoped, name }));
      student = await db.orm.public.Student.where({ userID: user.userID }).first();
    } else if (!user) {
      user = await db.orm.public.User.create({ email: key, name });
    }

    if (!student) {
      await db.orm.public.Student.create({ userID: user.userID, teamID });
    }
    studentIdByEmail.set(key, user.userID);
    return user.userID;
  }

  // commitHash is the global primary key, so dedupe against every stored commit, not just this repo's.
  const existingHashes = new Set(
    (await db.orm.public.Commit.select('commitHash').all()).map((c) => c.commitHash)
  );
  const newCommits = commits.filter((c) => !existingHashes.has(c.commitHash));

  for (const commit of newCommits) {
    const studentID = await studentIdFor(commit.authorEmail, commit.author);

    // Commit and its file changes go in together so a failed run can't leave a commit without files.
    await db.transaction(async (tx) => {
      await tx.orm.public.Commit.create({
        commitHash: commit.commitHash,
        isMerge: commit.parentHashes.length > 1 ? 1 : 0,
        dateTime: Temporal.Instant.fromEpochMilliseconds(commit.committedAtMs),
        commitSubject: commit.subject,
        commitBody: commit.body || null,
        refs: commit.refs || null,
        committer: commit.committer || null,
        author: commit.author || null,
        studentID,
      });

      for (const fc of commit.fileChanges) {
        await tx.orm.public.FileChange.create({
          commitHash: commit.commitHash,
          filePath: fc.filePath,
          additions: fc.additions,
          deletions: fc.deletions,
        });
      }
    });
  }

  return {
    teamID,
    parsed: commits.length,
    ingested: newCommits.length,
    alreadyPresent: commits.length - newCommits.length,
  };
}
