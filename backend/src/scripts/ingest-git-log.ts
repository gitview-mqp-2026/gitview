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
  filepath: string;
  additions: number;
  deletions: number;
}

interface ParsedCommit {
  hash: string;
  parentHashes: string;
  authorName: string;
  authorEmail: string;
  committedAt: string; // ISO 8601
  subject: string;
  fileChanges: ParsedFileChange[];
}

function parseGitLog(cwd: string): ParsedCommit[] {
  // --pretty=format: avoids extra trailing newlines; --numstat appends file stats per commit.
  // The --GITVIEW-COMMIT-- sentinel splits commits reliably regardless of message content.
  const raw = execSync(
    'git log --pretty=format:"--GITVIEW-COMMIT--%n%H%n%P%n%an%n%ae%n%at%n%s" --numstat',
    { cwd, encoding: 'utf-8', maxBuffer: 200 * 1024 * 1024 }
  );

  return raw
    .split('--GITVIEW-COMMIT--\n')
    .filter(Boolean)
    .flatMap((block): ParsedCommit[] => {
      const lines = block.split('\n');
      const hash = lines[0]?.trim() ?? '';
      if (hash.length !== 40) return []; // skip malformed blocks

      const parentHashes = lines[1]?.trim() ?? '';
      const authorName = lines[2]?.trim() ?? '';
      const authorEmail = lines[3]?.trim() ?? '';
      const unixTimestamp = parseInt(lines[4]?.trim() ?? '0', 10);
      const subject = lines[5]?.trim() ?? '';
      const committedAt = new Date(unixTimestamp * 1000).toISOString();

      // Line 6 is blank (numstat separator); file stat lines follow from index 7.
      const fileChanges: ParsedFileChange[] = [];
      for (let i = 7; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const match = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
        if (match) {
          fileChanges.push({
            filepath: match[3],
            additions: match[1] === '-' ? 0 : parseInt(match[1], 10),
            deletions: match[2] === '-' ? 0 : parseInt(match[2], 10),
          });
        }
      }

      return [{ hash, parentHashes, authorName, authorEmail, committedAt, subject, fileChanges }];
    });
}

async function main() {
  const commits = parseGitLog(repoPath!);
  console.log(`Parsed ${commits.length} commits from ${repoPath}`);

  // NOTE: The ORM calls below use the Prisma Next v8 RC query API
  // (db.orm.public.ModelName). The exact mutation method signatures (.create,
  // .createMany) should be verified against @prisma/orm-postgres v8 RC docs
  // once stable. After editing contract.prisma, run:
  //   cd backend && npx prisma contract emit && npx prisma db push
  // before running this script.

  let repo = await db.orm.public.Repository.where({ path: repoPath }).first();
  if (!repo) {
    repo = await db.orm.public.Repository.create({
      data: { name: repoName, path: repoPath! },
    });
  }

  const existingHashes = new Set(
    (await db.orm.public.Commit.where({ repositoryId: repo.id }).many()).map((c) => c.hash)
  );

  const newCommits = commits.filter((c) => !existingHashes.has(c.hash));
  console.log(`Ingesting ${newCommits.length} new commits (${existingHashes.size} already present)`);

  for (const commit of newCommits) {
    await db.orm.public.Commit.create({
      data: {
        hash: commit.hash,
        authorName: commit.authorName,
        authorEmail: commit.authorEmail,
        committedAt: commit.committedAt,
        subject: commit.subject,
        parentHashes: commit.parentHashes,
        repositoryId: repo.id,
      },
    });

    if (commit.fileChanges.length > 0) {
      await db.orm.public.FileChange.createMany({
        data: commit.fileChanges.map((fc) => ({
          commitHash: commit.hash,
          filepath: fc.filepath,
          additions: fc.additions,
          deletions: fc.deletions,
        })),
      });
    }
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
