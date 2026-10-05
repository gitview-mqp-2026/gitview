import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { ingestRepo, type IngestResult } from './ingest.js';
import { assertPublicHost, parseRepoUrl, RepoUrlError } from './repoUrl.js';

export { RepoUrlError };

const run = promisify(execFile);
const REPOS_DIR = fileURLToPath(new URL('../../.repos/', import.meta.url));
const CLONE_TIMEOUT_MS = 120_000;
const MAX_COMMITS = 2000;

export class AnalyzeError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// https only, no stored credentials, never prompt: this only ever reads public repositories.
const GIT_FLAGS = [
  '-c', 'protocol.allow=never',
  '-c', 'protocol.https.allow=always',
  '-c', 'credential.helper=',
];

async function git(args: string[]): Promise<void> {
  try {
    await run('git', [...GIT_FLAGS, ...args], {
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      timeout: CLONE_TIMEOUT_MS,
      killSignal: 'SIGKILL',
      maxBuffer: 1024 * 1024,
    });
  } catch (err: any) {
    if (err.killed) {
      throw new AnalyzeError(504, 'Cloning took too long. Try a smaller repository.');
    }
    throw new AnalyzeError(422, "Couldn't clone that repository. Check the URL and that it is public.");
  }
}

const inFlight = new Set<string>();

export async function analyzeRepo(input: unknown): Promise<IngestResult & { name: string; url: string }> {
  const url = parseRepoUrl(input);
  await assertPublicHost(url);

  if (inFlight.has(url.canonical)) {
    throw new AnalyzeError(409, 'That repository is already being analyzed.');
  }
  inFlight.add(url.canonical);

  try {
    mkdirSync(REPOS_DIR, { recursive: true });
    const dir = join(REPOS_DIR, `${createHash('sha1').update(url.canonical).digest('hex').slice(0, 16)}.git`);

    if (existsSync(dir)) {
      await git(['--git-dir', dir, 'fetch', '--quiet', '--prune', url.cloneUrl, '+refs/heads/*:refs/heads/*']);
    } else {
      try {
        await git(['clone', '--bare', '--quiet', '--', url.cloneUrl, dir]);
      } catch (err) {
        rmSync(dir, { recursive: true, force: true });
        throw err;
      }
    }

    const result = await ingestRepo({ path: dir, name: url.name, url: url.canonical, maxCommits: MAX_COMMITS });
    return { ...result, name: url.name, url: url.canonical };
  } finally {
    inFlight.delete(url.canonical);
  }
}
