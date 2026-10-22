import 'dotenv/config';
import { execFileSync } from 'child_process';
import { ingestRepo } from '../lib/ingest.js';
import { parseRepoUrl } from '../lib/repoUrl.js';

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

// Use the same canonical URL the web "Analyze Repo" flow stores, so both paths land on one Repository row.
function repoUrl(cwd: string): string {
  try {
    const remote = execFileSync('git', ['config', '--get', 'remote.origin.url'], { cwd, encoding: 'utf-8' }).trim();
    try {
      return parseRepoUrl(remote).canonical;
    } catch {
      return remote || cwd;
    }
  } catch {
    return cwd;
  }
}

ingestRepo({ path: repoPath, name: repoName, url: repoUrl(repoPath) })
  .then((r) => {
    console.log(`Parsed ${r.parsed} commits from ${repoPath}`);
    console.log(`Ingested ${r.ingested} new commits (${r.alreadyPresent} already present)`);
    console.log('Done.');
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
