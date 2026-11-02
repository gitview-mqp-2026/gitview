import { db } from '../prisma/db.js';
import { analyzeRepo } from './analyze.js';
import { GithubAppError, installationToken, listInstallationRepos, orgInstallation } from './githubApp.js';
import { parseRepoUrl } from './repoUrl.js';

export class CourseError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface CourseInput {
  courseName: string;
  courseTerm: string;
  githubOrg?: string;
  repoPattern?: string;
}

export interface SyncResult {
  matched: number;
  created: number;
  updated: number;
  skipped: number;
}

export interface IngestJob {
  courseID: number;
  status: 'running' | 'done';
  startedAt: string;
  finishedAt?: string;
  total: number;
  completed: number;
  results: { teamID: number; name: string; ok: boolean; ingested?: number; error?: string }[];
}

const ORG = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

function compilePattern(pattern: string): RegExp {
  if (pattern.length > 100) throw new CourseError(400, 'The repository name pattern is too long.');
  try {
    return new RegExp(pattern, 'i');
  } catch {
    throw new CourseError(400, 'The repository name pattern is not a valid regular expression.');
  }
}

// Auth isn't wired to the API yet, so courses belong to a single placeholder instructor.
async function placeholderInstructor(): Promise<number> {
  const existing = await db.orm.public.Instructor.first();
  if (existing) return existing.userID;
  const user = await db.orm.public.User.create({ email: 'instructor@gitview.local', name: 'Instructor' });
  await db.orm.public.Instructor.create({ userID: user.userID });
  return user.userID;
}

export async function createCourse(input: CourseInput) {
  const courseName = input.courseName?.trim();
  const courseTerm = input.courseTerm?.trim();
  if (!courseName || !courseTerm) throw new CourseError(400, 'A course needs a name and a term.');
  const githubOrg = input.githubOrg?.trim() || undefined;
  if (githubOrg && !ORG.test(githubOrg)) throw new CourseError(400, 'That is not a valid GitHub organization name.');
  const repoPattern = input.repoPattern?.trim() || undefined;
  if (repoPattern) compilePattern(repoPattern);

  let installationId: number | undefined;
  if (githubOrg) {
    const clash = await db.orm.public.Course.where({ githubOrg }).first();
    if (clash) throw new CourseError(409, 'A course is already linked to that organization.');
    installationId = (await orgInstallation(githubOrg)) ?? undefined;
    if (!installationId) throw new CourseError(409, notInstalled(githubOrg));
  }
  return db.orm.public.Course.create({
    courseName,
    courseTerm,
    githubOrg,
    installationId,
    repoPattern,
    instructorID: await placeholderInstructor(),
  });
}

async function courseById(courseID: number) {
  const course = Number.isInteger(courseID) ? await db.orm.public.Course.where({ courseID }).first() : null;
  if (!course) throw new CourseError(404, 'Course not found.');
  return course;
}

function notInstalled(org: string): string {
  return `The GitView GitHub App isn't installed on "${org}" yet. Install it on the organization, then try again.`;
}

// Each course carries its own installation. Older courses without one look it up from their org (and
// keep it); a course with no org falls back to the env installation.
async function installationFor(course: { courseID: number; githubOrg?: string | null; installationId?: number | null }): Promise<number> {
  if (course.installationId) return course.installationId;

  if (course.githubOrg) {
    const found = await orgInstallation(course.githubOrg);
    if (!found) throw new CourseError(409, notInstalled(course.githubOrg));
    await db.orm.public.Course.where({ courseID: course.courseID }).update({ installationId: found });
    return found;
  }

  const id = Number(process.env['GITHUB_INSTALLATION_ID']);
  if (!Number.isInteger(id) || id <= 0) throw new CourseError(503, 'No GitHub App installation is configured for this course.');
  return id;
}

// Pulls the repos the App can see in the course's org, keeps the ones whose name matches the course
// pattern, and links each to the course. Repos that stop matching are left as they are.
export async function syncCourse(courseID: number): Promise<SyncResult> {
  const course = await courseById(courseID);
  const pattern = course.repoPattern ? compilePattern(course.repoPattern) : null;
  const org = course.githubOrg?.toLowerCase();

  const all = await listInstallationRepos(await installationToken(await installationFor(course)));
  const matching = all.filter((r) => {
    if (r.archived) return false;
    const [owner, name] = r.fullName.split('/');
    if (org && owner.toLowerCase() !== org) return false;
    return !pattern || pattern.test(name);
  });

  let created = 0;
  let updated = 0;
  for (const r of matching) {
    const url = parseRepoUrl(r.htmlUrl).canonical;
    const githubRepoId = String(r.id);
    const name = r.fullName;
    const existing =
      (await db.orm.public.Repository.where({ githubRepoId }).first()) ??
      (await db.orm.public.Repository.where({ url }).first());
    if (existing) {
      await db.orm.public.Repository.where({ teamID: existing.teamID }).update({ url, name, githubRepoId, courseID });
      updated++;
    } else {
      await db.orm.public.Repository.create({ url, name, githubRepoId, courseID });
      created++;
    }
  }
  return { matched: matching.length, created, updated, skipped: all.length - matching.length };
}

const jobs = new Map<number, IngestJob>();

export function ingestStatus(courseID: number): IngestJob | null {
  return jobs.get(courseID) ?? null;
}

// Fetches and ingests every synced repo of the course in the background, one at a time. Each repo
// gets its own token narrowed to just that repo.
export async function startCourseIngest(courseID: number): Promise<IngestJob> {
  const course = await courseById(courseID);
  if (jobs.get(courseID)?.status === 'running') throw new CourseError(409, 'This course is already being ingested.');
  const installationId = await installationFor(course);

  const repos = (await db.orm.public.Repository.where({ courseID }).all()).filter((r) => r.githubRepoId);
  if (repos.length === 0) throw new CourseError(409, 'No repositories are synced for this course yet. Sync from GitHub first.');

  const job: IngestJob = {
    courseID,
    status: 'running',
    startedAt: new Date().toISOString(),
    total: repos.length,
    completed: 0,
    results: [],
  };
  jobs.set(courseID, job);

  void (async () => {
    for (const repo of repos) {
      try {
        const token = await installationToken(installationId, [Number(repo.githubRepoId)]);
        const result = await analyzeRepo(repo.url, { token });
        job.results.push({ teamID: repo.teamID, name: repo.name, ok: true, ingested: result.ingested });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`ingest failed for ${repo.name}:`, message);
        job.results.push({ teamID: repo.teamID, name: repo.name, ok: false, error: message });
      }
      job.completed++;
    }
    job.status = 'done';
    job.finishedAt = new Date().toISOString();
  })();

  return job;
}

export { GithubAppError };
