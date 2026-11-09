import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPOS_DIR = fileURLToPath(new URL('../../.repos/', import.meta.url));

export function repositoryMirrorPath(canonicalUrl: string): string {
  const id = createHash('sha1').update(canonicalUrl).digest('hex').slice(0, 16);
  return join(REPOS_DIR, `${id}.git`);
}

export { REPOS_DIR };
