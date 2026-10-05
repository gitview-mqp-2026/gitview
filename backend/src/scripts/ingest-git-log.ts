import 'dotenv/config';
import { execSync } from 'child_process';
import { db } from '../prisma/db.js';

// CLI: tsx src/scripts/ingest-git-log.ts --repo-path <path> [--repo-name <name>]
const args = process.argv.slice(2);
const repoPathArg = args.indexOf('--repo-path');
const repoNameArg = args.indexOf('--repo-name');

const repoPath = repoPathArg !== -1 ? args[repoPathArg + 1] : undefined;
const repoName =
  repoNameArg !== -1 ? args[repoNameArg + 1] : repoPath?.split(/[\\/]/).pop() ?? 'unknown';

if (!repoPath) {
  console.error('Usage: tsx src/scripts/ingest-git-log.ts --repo-path <path> [--repo-name <name>]');
  process.exit(1);
}

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

const COMMIT_MARK = '--GITVIEW-COMMIT--';
const BODY_START = '--GITVIEW-BODY--';
const BODY_END = '--GITVIEW-BODY-END--';

function parseGitLog(cwd: string): ParsedCommit[] {
  // Fixed-position header lines, then a marker-delimited body (it can span lines), then --numstat rows.
  const raw = execSync(
    `git log --pretty=format:"${COMMIT_MARK}%n%H%n%P%n%an%n%ae%n%at%n%cn%n%D%n%s%n${BODY_START}%n%b%n${BODY_END}" --numstat`,
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

function remoteUrl(cwd: string): string | null {
  try {
    return execSync('git config --get remote.origin.url', { cwd, encoding: 'utf-8' }).trim() || null;
  } catch {
    return null;
  }
}

async function main() {
  const commits = parseGitLog(repoPath!);
  console.log(`Parsed ${commits.length} commits from ${repoPath}`);

  // Repository has no path column, so the remote URL (falling back to the local path) is its identity.
  const url = remoteUrl(repoPath!) ?? repoPath!;
  let repo = await db.orm.public.Repository.where({ url }).first();
  if (!repo) {
    repo = await db.orm.public.Repository.create({ url, name: repoName });
  }

  // Every Commit needs a Student, and every Student needs a User, so build both from commit authors.
  const studentIdByEmail = new Map<string, number>();
  async function studentIdFor(email: string, name: string): Promise<number> {
    const key = email || `${name}@unknown`;
    const cached = studentIdByEmail.get(key);
    if (cached !== undefined) return cached;

    let user = await db.orm.public.User.where({ email: key }).first();
    if (!user) {
      user = await db.orm.public.User.create({ email: key, name });
    }
    const student = await db.orm.public.Student.where({ userID: user.userID }).first();
    if (!student) {
      await db.orm.public.Student.create({ userID: user.userID, teamID: repo!.teamID });
    }
    studentIdByEmail.set(key, user.userID);
    return user.userID;
  }

  // commitHash is the global primary key, so dedupe against every stored commit, not just this repo's.
  const existingHashes = new Set(
    (await db.orm.public.Commit.select('commitHash').all()).map((c) => c.commitHash)
  );

  const newCommits = commits.filter((c) => !existingHashes.has(c.commitHash));
  console.log(`Ingesting ${newCommits.length} new commits (${existingHashes.size} already present)`);

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

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
