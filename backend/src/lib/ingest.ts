import { Temporal } from 'temporal-polyfill';
import { db } from '../prisma/db.js';
import { getGithubUser } from './githubApp.js';
import { readGitLog, type ParsedCommit } from './gitLog.js';

function usernameFromEmail(email: string): string | null {
  const match = email.trim().match(
    /^(?:\d+\+)?([^@]+)@users\.noreply\.github\.com$/i
  );

  return match ? match[1].toLowerCase() : null;
}

function usernameFromAuthor(name: string): string | null {
  const username = name.trim();

  // Only try names that could be GitHub usernames.
  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(username)) {
    return null;
  }

  return username.toLowerCase();
}

function isBotAuthor(name: string, email: string): boolean {
  const username = usernameFromEmail(email);

  return (
    /\[bot\]/i.test(name) ||
    /\[bot\]/i.test(email) ||
    (username !== null && /\[bot\]$/i.test(username)) ||
    /^(github-actions|github-classroom|dependabot)(?:\[bot\])?$/i.test(
      username ?? ''
    )
  );
}

function normalizeIdentity(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export interface IngestResult {
  teamID: number;
  parsed: number;
  ingested: number;
  alreadyPresent: number;
}

export function parseGitLog(cwd: string, maxCommits?: number): ParsedCommit[] {
  return readGitLog(cwd, maxCommits);
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

    // Load existing users and students for this team.
  const existingUsers = await db.orm.public.User
    .select('userID', 'email', 'username', 'name')
    .all();

  const existingStudents = await db.orm.public.Student
    .select('userID', 'teamID')
    .all();

  const studentsOnTeam: {
    userID: number;
    email: string;
    username: string | null;
    name: string | null;
  }[] = existingStudents
    .filter((student) => student.teamID === teamID)
    .flatMap((student) => {
      const user = existingUsers.find(
        (u) => u.userID === student.userID
      );

      return user ? [user] : [];
    });

  const studentIdByIdentity = new Map<string, number>();

  // Cache GitHub user profiles to avoid repeated API calls.
  const githubProfileCache = new Map<
    string,
    { username: string; name: string | null } | null
  >();

  async function getCachedGithubUser(username: string) {
    if (!githubProfileCache.has(username)) {
      const profile = await getGithubUser(username);
      githubProfileCache.set(username, profile);
    }

    return githubProfileCache.get(username) ?? null;
  }

  async function studentIdFor(email: string, name: string): Promise<number> {
    const githubUsername = usernameFromEmail(email) ?? usernameFromAuthor(name);
    const emailIdentity = normalizeIdentity(email.split('@')[0]);
    const authorName = normalizeName(name);

    const githubProfile = githubUsername
      ? await getCachedGithubUser(githubUsername)
      : null;

    const githubName = githubProfile?.name?.trim() || null;

    const cacheKey = githubUsername
      ? `github:${githubUsername}`
      : `email:${email.toLowerCase()}`;

    const cached = studentIdByIdentity.get(cacheKey);
    if (cached !== undefined) return cached;

    // Match by GitHub username.
    let matches = githubUsername
      ? studentsOnTeam.filter(
          (student) =>
            student.username?.toLowerCase() === githubUsername ||
            usernameFromEmail(student.email) === githubUsername
        )
      : [];

    // If there is no username match, compare the email prefix against existing GitHub usernames.
    if (matches.length === 0 && emailIdentity) {
      matches = studentsOnTeam.filter(
        (student) =>
          student.username &&
          normalizeIdentity(student.username) === emailIdentity
      );
    }

    // Else, use the author name only if there is one unique match.
    if (matches.length === 0 && authorName) {
      matches = studentsOnTeam.filter(
        (student) =>
          student.name &&
          normalizeName(student.name) === authorName
      );
    }

    if (matches.length === 1) {
      const matchedUser = matches[0];

      const updates: {
        username?: string;
        name?: string;
      } = {};

      // Save a newly discovered GitHub username.
      if (githubUsername && !matchedUser.username) {
        updates.username = githubUsername;
        matchedUser.username = githubUsername;
      }

      // Use GitHub profile name if existing name is missing or just the GitHub username.
      if (
        githubName &&
        (!matchedUser.name ||
          normalizeName(matchedUser.name) === normalizeName(githubUsername ?? ''))
      ) {
        updates.name = githubName;
        matchedUser.name = githubName;
      }

      if (Object.keys(updates).length > 0) {
        await db.orm.public.User.update(
          { userID: matchedUser.userID },
          updates
        );
      }

      studentIdByIdentity.set(cacheKey, matchedUser.userID);
      return matchedUser.userID;
    }

    // No unique match: create or reuse a user by email.
    const key = email || `${name}@unknown`;

    let user = await db.orm.public.User.where({ email: key }).first();

    if (!user) {
      user = await db.orm.public.User.create({
        email: key,
        name: githubName ?? name,
        username: githubUsername,
      });
    }

    let student = await db.orm.public.Student
      .where({ userID: user.userID })
      .first();

    if (!student) {
      await db.orm.public.Student.create({
        userID: user.userID,
        teamID,
      });
    }

    studentIdByIdentity.set(cacheKey, user.userID);

    studentsOnTeam.push({
      ...user,
      username: user.username ?? githubUsername,
    });

    return user.userID;
  }

  // commitHash is the global primary key, so dedupe against every stored commit, not just this repo's.
  const humanCommits = commits.filter(
  (commit) => !isBotAuthor(commit.author, commit.authorEmail)
  );

  const existingHashes = new Set(
    (await db.orm.public.Commit.select('commitHash').all()).map((c) => c.commitHash)
  );

  const newCommits = humanCommits.filter(
    (commit) => !existingHashes.has(commit.commitHash)
  );
  
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
