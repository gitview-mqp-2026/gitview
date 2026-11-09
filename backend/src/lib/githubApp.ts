import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';

const API = 'https://api.github.com';

export class GithubAppError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface InstallationRepo {
  id: number;
  fullName: string;
  htmlUrl: string;
  archived: boolean;
}

export interface GithubOrgMember {
  id: number;
  login: string;
  avatarUrl: string;
  htmlUrl: string;
}

// The App's identity is a short-lived JWT signed with its private key; it is only used to ask for installation tokens.
function appJwt(): string {
  const appId = process.env['GITHUB_APP_ID'];
  const keyPath = process.env['GITHUB_APP_PRIVATE_KEY_PATH'];
  if (!appId || !keyPath) {
    throw new GithubAppError(503, 'The GitHub App is not configured (GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY_PATH).');
  }
  let key: string;
  try {
    key = readFileSync(keyPath, 'utf8');
  } catch {
    throw new GithubAppError(503, 'Could not read the GitHub App private key.');
  }
  const now = Math.floor(Date.now() / 1000);
  const part = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${part({ alg: 'RS256', typ: 'JWT' })}.${part({ iat: now - 60, exp: now + 540, iss: appId })}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(key).toString('base64url');
  return `${unsigned}.${signature}`;
}

async function github<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'gitview',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!res.ok) {
    const status = res.status === 401 || res.status === 403 || res.status === 404 ? res.status : 502;
    throw new GithubAppError(status, `GitHub returned ${res.status} for ${init.method ?? 'GET'} ${path.split('?')[0]}.`);
  }
  return (await res.json()) as T;
}

// Tokens last an hour; reuse the full-scope one until a minute before it lapses.
const cache = new Map<number, { token: string; expiresAt: number }>();

// Pass repositoryIds to narrow the token to those repos (not cached).
export async function installationToken(installationId: number, repositoryIds?: number[]): Promise<string> {
  const narrowed = repositoryIds && repositoryIds.length > 0;
  const hit = cache.get(installationId);
  if (!narrowed && hit && hit.expiresAt - 60_000 > Date.now()) return hit.token;

  const body = await github<{ token: string; expires_at: string }>(
    `/app/installations/${installationId}/access_tokens`,
    appJwt(),
    { method: 'POST', body: narrowed ? JSON.stringify({ repository_ids: repositoryIds }) : undefined }
  );
  if (!narrowed) cache.set(installationId, { token: body.token, expiresAt: Date.parse(body.expires_at) });
  return body.token;
}

// Which GitHub account an installation belongs to, so a course's org can be checked against it.
export async function installationAccount(installationId: number): Promise<string> {
  const body = await github<{ account: { login: string } | null }>(`/app/installations/${installationId}`, appJwt());
  return body.account?.login ?? '';
}

export async function listInstallationRepos(token: string): Promise<InstallationRepo[]> {
  const repos: InstallationRepo[] = [];
  for (let page = 1; ; page++) {
    const body = await github<{
      repositories: { id: number; full_name: string; html_url: string; archived: boolean }[];
    }>(`/installation/repositories?per_page=100&page=${page}`, token);
    repos.push(...body.repositories.map((r) => ({ id: r.id, fullName: r.full_name, htmlUrl: r.html_url, archived: r.archived })));
    if (body.repositories.length < 100) return repos;
  }
}

// List all members of an organization. 
export async function listOrganizationMembers(
  org: string,
  token: string
): Promise<GithubOrgMember[]> {
  const members: GithubOrgMember[] = [];

  for (let page = 1; ; page++) {
    const body = await github<
      {
        id: number;
        login: string;
        avatar_url: string;
        html_url: string;
      }[]
    >(
      `/orgs/${encodeURIComponent(org)}/members?filter=all&per_page=100&page=${page}`,
      token
    );

    console.log('GitHub members API response:', {
      page,
      count: body.length,
      firstMember: body[0],
    });

    members.push(
      ...body.map((member) => ({
        id: member.id,
        login: member.login,
        avatarUrl: member.avatar_url,
        htmlUrl: member.html_url,
      }))
    );

    if (body.length < 100) return members;
  }
}

// The installation id for an org, so instructors never copy it by hand. Null when the App isn't installed there.
export async function orgInstallation(org: string): Promise<number | null> {
  try {
    const body = await github<{ id: number }>(`/orgs/${encodeURIComponent(org)}/installation`, appJwt());
    return body.id;
  } catch (err) {
    if (err instanceof GithubAppError && err.status === 404) return null;
    throw err;
  }
}

// Where an org owner installs the App and picks which repos it can read.
export function installUrl(): string | null {
  const slug = process.env['GITHUB_APP_SLUG'];
  return slug ? `https://github.com/apps/${encodeURIComponent(slug)}/installations/new` : null;
}

// Get GitHub user info by username.
export async function getGithubUser(username: string) {
  const response = await fetch(
    `https://api.github.com/users/${encodeURIComponent(username)}`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );

  if (!response.ok) {
    return null;
  }

  const user = await response.json();

  return {
    username: user.login,
    name: user.name ?? null,
  };
}