import 'dotenv/config';
import { existsSync } from 'node:fs';
import { db } from '../prisma/db.js';
import { refreshFileChanges, type RefreshSummary } from '../lib/refreshFileChanges.js';
import { repositoryMirrorPath } from '../lib/repositoryMirror.js';

// CLI: tsx src/scripts/refresh-file-changes.ts [--course <id>] [--apply]
// Re-reads each repository's local mirror and updates the stored file changes of commits the app already has.
// A dry run (the default) only reports what would change; pass --apply to write. No network access is used.
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const courseArg = args.indexOf('--course');
const courseID = courseArg !== -1 ? Number(args[courseArg + 1]) : null;
if (courseArg !== -1 && !Number.isInteger(courseID)) {
  console.error('Usage: tsx src/scripts/refresh-file-changes.ts [--course <id>] [--apply]');
  process.exit(1);
}

const repositories = (await db.orm.public.Repository.all())
  .filter((repository) => courseID === null || repository.courseID === courseID)
  .sort((a, b) => a.teamID - b.teamID);

console.log(`${apply ? 'APPLYING' : 'DRY RUN (nothing will be written)'}: ${repositories.length} repositories`);

const total: RefreshSummary = {
  commitsInHistory: 0, commitsStored: 0, commitsChanged: 0, rowsBefore: 0, rowsAfter: 0, linesBefore: 0, linesAfter: 0, renameRowsBefore: 0, remainingDifferences: 0,
};
let skipped = 0;

for (const repository of repositories) {
  const gitDir = repositoryMirrorPath(repository.url);
  if (!existsSync(gitDir)) {
    console.log(`  team ${String(repository.teamID).padStart(2)}  skipped, no local mirror for ${repository.name}`);
    skipped += 1;
    continue;
  }
  const result = await refreshFileChanges({ gitDir, apply });
  for (const key of Object.keys(total) as (keyof RefreshSummary)[]) total[key] += result[key];
  console.log(
    `  team ${String(repository.teamID).padStart(2)}  ${String(result.commitsChanged).padStart(4)}/${String(result.commitsStored).padStart(4)} commits changed` +
      `  rows ${result.rowsBefore} -> ${result.rowsAfter}  lines ${result.linesBefore} -> ${result.linesAfter}  rename rows fixed ${result.renameRowsBefore}`,
  );
}

console.log(
  `\nTotal: ${total.commitsChanged}/${total.commitsStored} stored commits ${apply ? 'updated' : 'would change'}; ` +
    `rows ${total.rowsBefore} -> ${total.rowsAfter}; lines ${total.linesBefore} -> ${total.linesAfter}; ` +
    `rename-path rows ${total.renameRowsBefore} -> 0` + (skipped ? `; ${skipped} skipped` : ''),
);
if (!apply) console.log('Dry run only. Re-run with --apply to write these changes.');
if (apply) {
  if (total.remainingDifferences > 0) {
    console.error(`\nVERIFICATION FAILED: ${total.remainingDifferences} commits still differ from git after re-reading the database.`);
    process.exit(1);
  }
  console.log('Verified: re-read the database and every stored commit now matches git.');
}
process.exit(0);
