import { execFileSync } from 'child_process';
import { Temporal } from 'temporal-polyfill';
import { db } from '../prisma/db.js';
import { getGithubUser } from './githubApp.js';

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

const COMMIT_MARK = '--GITVIEW-COMMIT--';
const BODY_START = '--GITVIEW-BODY--';
const BODY_END = '--GITVIEW-BODY-END--';

export function parseGitLog(cwd: string, maxCommits?: number): ParsedCommit[] {
  // Fixed-position header lines, then a marker-delimited body (it can span lines), then --numstat rows.
  const raw = execFileSync(
    'git',
    [
      'log',
      ...(maxCommits ? [`--max-count=${maxCommits}`] : []),
      `--pretty=format:${COMMIT_MARK}%n%H%n%P%n%an%n%ae%n%at%n%cn%n%D%n%s%n${BODY_START}%n%b%n${BODY_END}`,
      '--numstat',
    ],
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

  // identities merged into a student on the Roster page
  const aliasByIdentity = new Map<string, number>(
    (await db.orm.public.StudentAlias.where({ teamID }).all()).map((alias) => [alias.identity, alias.userID])
  );

  // keys a commit author can be found under in the alias table
  function aliasKeys(email: string, verifiedUsername: string | null, githubUsername: string | null): string[] {
    const keys = [`email:${email.toLowerCase()}`];
    if (verifiedUsername) {
      keys.push(`github:${verifiedUsername}`);
    }
    if (githubUsername && githubUsername !== verifiedUsername) {
      keys.push(`github:${githubUsername}`);
    }
    return keys;
  }

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
    // only a noreply email is a confirmed GitHub account
    const verifiedUsername = usernameFromEmail(email);
    const githubUsername = verifiedUsername ?? usernameFromAuthor(name);
    const emailIdentity = normalizeIdentity(email.split('@')[0]);
    const authorName = normalizeName(name);

    const githubProfile = verifiedUsername
      ? await getCachedGithubUser(verifiedUsername)
      : null;

    const githubName = githubProfile?.name?.trim() || null;

    // an author name that is just a username isn't the full name 
    const authorDisplayName =
      /\s/.test(name.trim()) && normalizeName(name) !== normalizeName(githubUsername ?? '')
        ? name.trim()
        : null;

    const cacheKey = githubUsername
      ? `github:${githubUsername}`
      : `email:${email.toLowerCase()}`;

    const cached = studentIdByIdentity.get(cacheKey);
    if (cached !== undefined) return cached;

    // an identity that was merged into another student maps to that student
    const aliased = aliasKeys(email, verifiedUsername, githubUsername)
      .map((key) => aliasByIdentity.get(key))
      .find((id) => id !== undefined);
    if (aliased !== undefined) {
      studentIdByIdentity.set(cacheKey, aliased);
      return aliased;
    }

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

    // match git email to a student's real name, or a student's email against the author name
    if (matches.length === 0) {
      const authorKeys = [authorName, githubName ? normalizeName(githubName) : '']
        .filter(Boolean)
        .map(normalizeIdentity);
      matches = studentsOnTeam.filter((student) => {
        const studentEmailKey = normalizeIdentity(student.email.split('@')[0]);
        return (
          (emailIdentity && student.name && normalizeIdentity(student.name) === emailIdentity) ||
          (studentEmailKey && authorKeys.includes(studentEmailKey))
        );
      });
    }

    if (matches.length === 1) {
      const matchedUser = matches[0];

      const updates: {
        username?: string;
        name?: string;
      } = {};

      // Save a newly discovered GitHub username.
      if (verifiedUsername && !matchedUser.username) {
        updates.username = verifiedUsername;
        matchedUser.username = verifiedUsername;
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
        name: githubName ?? authorDisplayName,
        username: verifiedUsername,
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
      username: user.username ?? verifiedUsername,
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
