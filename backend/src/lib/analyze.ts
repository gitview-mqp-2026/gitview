import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { promisify } from 'node:util';
import { ingestRepo, type IngestResult } from './ingest.js';
import { repositoryMirrorPath, REPOS_DIR } from './repositoryMirror.js';
import { assertPublicHost, parseRepoUrl, RepoUrlError } from './repoUrl.js';

export { RepoUrlError };

const run = promisify(execFile);
const CLONE_TIMEOUT_MS = 120_000;
const MAX_COMMITS = 2000;

export class AnalyzeError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// https only, no stored credentials, never prompt. Private repos get a GitHub App installation token
// per call (see authEnv), never a stored credential.
const GIT_FLAGS = [
  '-c', 'protocol.allow=never',
  '-c', 'protocol.https.allow=always',
  '-c', 'credential.helper=',
];

async function git(args: string[]): Promise<string> {
  try {
    const { stdout } = await run('git', [...GIT_FLAGS, ...args], {
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      encoding: 'utf8',
      timeout: CLONE_TIMEOUT_MS,
      killSignal: 'SIGKILL',
      maxBuffer: 1024 * 1024,
    });
    return stdout;
  } catch (err: any) {
    if (err.killed) {
      throw new AnalyzeError(504, 'Cloning took too long. Try a smaller repository.');
    }
    throw new AnalyzeError(
      422,
      token
        ? "Couldn't fetch that repository. Check that the GitHub App is installed on it."
        : "Couldn't clone that repository. Check the URL and that it is public."
    );
  }
}

const inFlight = new Set<string>();

// Pass an installation token to read a private repository the GitHub App can see.
export async function analyzeRepo(
  input: unknown,
  opts: { token?: string } = {}
): Promise<IngestResult & { name: string; url: string }> {
  const { token } = opts;
  const url = parseRepoUrl(input);
  await assertPublicHost(url);

  if (inFlight.has(url.canonical)) {
    throw new AnalyzeError(409, 'That repository is already being analyzed.');
  }
  inFlight.add(url.canonical);

  try {
    mkdirSync(REPOS_DIR, { recursive: true });
    const dir = repositoryMirrorPath(url.canonical);

    if (existsSync(dir)) {
      const remoteHead = await git(['ls-remote', '--symref', '--', url.cloneUrl, 'HEAD']);
      await git(['--git-dir', dir, 'fetch', '--quiet', '--prune', url.cloneUrl, '+refs/heads/*:refs/heads/*']);
      const defaultBranch = remoteHead.match(/^ref: refs\/heads\/(.+)\tHEAD$/m)?.[1];
      if (defaultBranch) await git(['--git-dir', dir, 'symbolic-ref', 'HEAD', `refs/heads/${defaultBranch}`]);
    } else {
      try {
        await git(['clone', '--bare', '--quiet', '--', url.cloneUrl, dir], token);
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
