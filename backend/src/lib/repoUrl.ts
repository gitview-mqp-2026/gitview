import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export interface RepoUrl {
  /** Identity stored in Repository.url, e.g. https://github.com/owner/repo */
  canonical: string;
  /** What we hand to git clone */
  cloneUrl: string;
  /** owner/repo */
  name: string;
}

export class RepoUrlError extends Error {}

const SEGMENT = /^[A-Za-z0-9._-]+$/;
const HOST = /^(?=.{1,253}$)([a-z0-9-]+\.)+[a-z]{2,63}$/;

// Accepts https://host/owner/repo(.git), http:// (upgraded to https), ssh://git@host/owner/repo
// and scp-style git@host:owner/repo. Anything else (file://, ext::, git://, creds in the URL) is rejected.
export function parseRepoUrl(input: unknown): RepoUrl {
  if (typeof input !== 'string' || input.length > 300) throw new RepoUrlError('Enter a repository URL.');
  const raw = input.trim();

  let host: string;
  let path: string;

  const scp = raw.match(/^git@([^:/\s]+):(.+)$/i);
  if (scp) {
    host = scp[1];
    path = scp[2];
  } else {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new RepoUrlError('That does not look like a repository URL.');
    }
    const sshUser = url.protocol === 'ssh:' && url.username === 'git' && !url.password;
    if (!['https:', 'http:'].includes(url.protocol) && !sshUser) {
      throw new RepoUrlError('Only https and ssh repository URLs are supported.');
    }
    if (url.protocol !== 'ssh:' && (url.username || url.password)) {
      throw new RepoUrlError('Remove credentials from the URL; only public repositories are supported.');
    }
    if (url.port || url.search || url.hash) throw new RepoUrlError('Use a plain repository URL.');
    host = url.hostname;
    path = url.pathname;
  }

  host = host.toLowerCase();
  if (isIP(host) || !HOST.test(host)) throw new RepoUrlError('Use a repository hosted on a public domain.');

  const segments = path.replace(/^\/+|\/+$/g, '').replace(/\.git$/i, '').split('/');
  if (segments.length < 2 || segments.some((s) => !SEGMENT.test(s) || s === '.' || s === '..')) {
    throw new RepoUrlError('Expected a URL like https://github.com/owner/repo.');
  }

  const canonical = `https://${host}/${segments.join('/')}`;
  return { canonical, cloneUrl: `${canonical}.git`, name: segments.join('/') };
}

function isPrivateAddress(addr: string): boolean {
  if (addr.includes(':')) {
    const a = addr.toLowerCase();
    return a === '::1' || a === '::' || a.startsWith('fc') || a.startsWith('fd') || a.startsWith('fe80') || a.startsWith('::ffff:');
  }
  const [a, b] = addr.split('.').map(Number);
  return (
    a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)
  );
}

// Stops a public-looking hostname from pointing the server at its own network.
export async function assertPublicHost(url: RepoUrl): Promise<void> {
  const host = new URL(url.canonical).hostname;
  let addrs: { address: string }[];
  try {
    addrs = await lookup(host, { all: true });
  } catch {
    throw new RepoUrlError(`Could not resolve ${host}.`);
  }
  if (addrs.length === 0 || addrs.some((a) => isPrivateAddress(a.address))) {
    throw new RepoUrlError('That host is not reachable as a public repository.');
  }
}
