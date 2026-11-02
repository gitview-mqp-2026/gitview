import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { db } from './prisma/db.js';
import { analyzeRepo, AnalyzeError, RepoUrlError } from './lib/analyze.js';
import { countPullRequestsMerged } from './lib/stats.js';
import { CourseError, createCourse, ingestStatus, startCourseIngest, syncCourse } from './lib/courses.js';
import { GithubAppError, installUrl } from './lib/githubApp.js';

const app = express();
app.use(cors());
app.use(express.json());

// Commits written by a team's students, newest first.
async function commitsForTeam(teamID: number) {
  const students = await db.orm.public.Student.where({ teamID }).all();
  const studentIds = new Set(students.map((s) => s.userID));
  const commits = await db.orm.public.Commit.orderBy((c) => c.dateTime.desc()).all();
  return { students, commits: commits.filter((c) => studentIds.has(c.studentID)) };
}

// Newest first, with a commit count and last-commit time for the Home widgets.
app.get('/api/repositories', async (req, res) => {
  try {
    const courseID = Number(req.query.courseId);
    const [repos, students, commits] = await Promise.all([
      req.query.courseId ? db.orm.public.Repository.where({ courseID }).all() : db.orm.public.Repository.all(),
      db.orm.public.Student.all(),
      db.orm.public.Commit.orderBy((c) => c.dateTime.desc()).all(),
    ]);
    const teamByStudent = new Map(students.map((s) => [s.userID, s.teamID]));
    const counts = new Map<number, { commitCount: number; lastCommitAt: unknown }>();
    for (const c of commits) {
      const team = teamByStudent.get(c.studentID);
      if (team === undefined) continue;
      const entry = counts.get(team) ?? { commitCount: 0, lastCommitAt: c.dateTime };
      entry.commitCount += 1;
      counts.set(team, entry);
    }
    res.json(
      repos
        .sort((a, b) => b.teamID - a.teamID)
        .map((r) => ({ ...r, commitCount: counts.get(r.teamID)?.commitCount ?? 0, lastCommitAt: counts.get(r.teamID)?.lastCommitAt ?? null }))
    );
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Clones a public repo and ingests its log; the Repository row it creates is the "saved" repo.
app.post('/api/repositories/analyze', async (req, res) => {
  try {
    res.json(await analyzeRepo(req.body?.url));
  } catch (err) {
    if (err instanceof RepoUrlError) {
      res.status(400).json({ error: err.message });
    } else if (err instanceof AnalyzeError) {
      res.status(err.status).json({ error: err.message });
    } else {
      console.error(err);
      res.status(500).json({ error: 'Something went wrong analyzing that repository.' });
    }
  }
});

// Comments and issues closed aren't in git history; they stay 0 until a source (e.g. the GitHub API) is wired in.
app.get('/api/repositories/:teamId/stats', async (req, res) => {
  try {
    const teamID = Number(req.params.teamId);
    const repo = Number.isInteger(teamID) ? await db.orm.public.Repository.where({ teamID }).first() : null;
    if (!repo) {
      res.status(404).json({ error: 'Repository not found' });
      return;
    }
    const { students, commits } = await commitsForTeam(teamID);
    res.json({
      teamID,
      courseID: repo.courseID ?? null,
      name: repo.name,
      url: repo.url,
      members: students.length,
      commits: commits.length,
      prsMerged: countPullRequestsMerged(commits.map((c) => c.commitSubject)),
      comments: 0,
      issuesClosed: 0,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Optional ?teamId= narrows to commits written by that team's students.
app.get('/api/commits', async (req, res) => {
  try {
    if (req.query.teamId) {
      res.json((await commitsForTeam(Number(req.query.teamId))).commits);
    } else {
      res.json(await db.orm.public.Commit.orderBy((c) => c.dateTime.desc()).all());
    }
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get('/api/commits/:hash/files', async (req, res) => {
  try {
    res.json(await db.orm.public.FileChange.where({ commitHash: req.params.hash }).all());
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Maps the errors the course/GitHub code throws onto HTTP statuses; anything else is a 500.
function sendError(res: express.Response, err: unknown) {
  if (err instanceof CourseError || err instanceof GithubAppError || err instanceof AnalyzeError || err instanceof RepoUrlError) {
    res.status('status' in err ? err.status : 400).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong.' });
}

// Where an org owner installs the GitHub App; the Add Course form links here.
app.get('/api/github-app', (_req, res) => {
  res.json({ installUrl: installUrl() });
});

// Optional ?instructorId= narrows to one instructor's courses.
app.get('/api/courses', async (req, res) => {
  try {
    const instructorID = Number(req.query.instructorId);
    const [courses, repos] = await Promise.all([
      req.query.instructorId ? db.orm.public.Course.where({ instructorID }).all() : db.orm.public.Course.all(),
      db.orm.public.Repository.all(),
    ]);
    res.json(courses.map((c) => ({ ...c, repoCount: repos.filter((r) => r.courseID === c.courseID).length })));
  } catch (err) {
    sendError(res, err);
  }
});

app.post('/api/courses', async (req, res) => {
  try {
    res.status(201).json(await createCourse(req.body ?? {}));
  } catch (err) {
    sendError(res, err);
  }
});

// Links the org's repos (filtered by the course's name pattern) to the course.
app.post('/api/courses/:courseId/sync', async (req, res) => {
  try {
    res.json(await syncCourse(Number(req.params.courseId)));
  } catch (err) {
    sendError(res, err);
  }
});

// Starts a background ingest of every synced repo; poll the GET for progress.
app.post('/api/courses/:courseId/ingest', async (req, res) => {
  try {
    res.status(202).json(await startCourseIngest(Number(req.params.courseId)));
  } catch (err) {
    sendError(res, err);
  }
});

app.get('/api/courses/:courseId/ingest', (req, res) => {
  res.json(ingestStatus(Number(req.params.courseId)) ?? { status: 'idle' });
});

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => console.log(`API running on :${PORT}`));
