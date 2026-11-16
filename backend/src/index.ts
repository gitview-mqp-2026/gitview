import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { db } from './prisma/db.js';
import { analyzeRepo, AnalyzeError, RepoUrlError } from './lib/analyze.js';
import {
  commitTagsByHash,
  FILE_CATEGORIES,
  normalizeFileCategory,
  parseFileLabelInput,
  parseFilePath,
  parseTeamId,
} from './lib/fileLabels.js';
import { directoryPaths, filePaths, readRepositoryTree, RepositoryTreeError } from './lib/repositoryTree.js';
import { countPullRequestsMerged } from './lib/stats.js';
import { CourseError, createCourse, ingestStatus, startCourseIngest, syncCourse } from './lib/courses.js';
import { GithubAppError, installUrl } from './lib/githubApp.js';
import { buildTeamAlerts } from './lib/alerts.js';

const app = express();
app.use(cors());
app.use(express.json());

// Commits written by a team's students, newest first.
async function commitsForTeam(teamID: number) {
  const students = await db.orm.public.Student.where({ teamID }).all();
  const studentIds = students.map((student) => student.userID);
  const commits = studentIds.length === 0
    ? []
    : await db.orm.public.Commit
      .where((commit) => commit.studentID.in(studentIds))
      .orderBy((commit) => commit.dateTime.desc())
      .all();
  return { students, commits };
}

// Newest first, with a commit count and last-commit time for the Home widgets.
app.get('/repositories', async (req, res) => {
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
app.post('/repositories/analyze', async (req, res) => {
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
app.get('/repositories/:teamId/stats', async (req, res) => {
  try {
    const teamID = Number(req.params.teamId);
    const repo = Number.isInteger(teamID) ? await db.orm.public.Repository.where({ teamID }).first() : null;
    if (!repo) {
      res.status(404).json({ error: 'Repository not found' });
      return;
    }
    const { students, commits } = await commitsForTeam(teamID);
    const studentIds = students.map((student) => student.userID);
    const users = studentIds.length === 0
      ? []
      : await db.orm.public.User.where((user) => user.userID.in(studentIds)).all();
    const usersById = new Map(users.map((user) => [user.userID, user]));
    const teamMembers = students
      .map((student) => {
        const user = usersById.get(student.userID);
        const name = user?.name?.trim() || null;
        const username = user?.username?.trim() || null;
        return {
          userID: student.userID,
          name,
          username,
          displayName: name ?? (username ? `@${username}` : `Student ${student.userID}`),
        };
      })
      .sort((a, b) => a.userID - b.userID);
    res.json({
      teamID,
      courseID: repo.courseID ?? null,
      name: repo.name,
      url: repo.url,
      members: teamMembers.length,
      teamMembers,
      commits: commits.length,
      prsMerged: countPullRequestsMerged(commits.map((c) => c.commitSubject)),
      comments: 0,
      issuesClosed: 0,
      alerts: buildTeamAlerts(teamMembers, commits),
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get('/repositories/:teamId/tree', async (req, res) => {
  try {
    const teamID = parseTeamId(req.params.teamId);
    if (!teamID) {
      res.status(400).json({ error: 'Invalid repository id.' });
      return;
    }

    const repo = await db.orm.public.Repository.where({ teamID }).first();
    if (!repo) {
      res.status(404).json({ error: 'Repository not found' });
      return;
    }

    const [tree, labels, directoryLabels] = await Promise.all([
      readRepositoryTree(repo.url),
      db.orm.public.RepositoryFileLabel.where({ teamID }).all(),
      db.orm.public.RepositoryDirectoryLabel.where({ teamID }).all(),
    ]);
    const presentPaths = filePaths(tree.nodes);
    const presentDirectoryPaths = directoryPaths(tree.nodes);
    res.json({
      ...tree,
      categories: FILE_CATEGORIES,
      labels: labels.map((label) => ({
        path: label.path,
        category: normalizeFileCategory(label.category) ?? label.category,
        present: presentPaths.has(label.path),
      })),
      directoryLabels: directoryLabels.map((label) => ({
        path: label.path,
        category: normalizeFileCategory(label.category) ?? label.category,
        present: presentDirectoryPaths.has(label.path),
      })),
    });
  } catch (err) {
    if (err instanceof RepositoryTreeError) {
      res.status(err.status).json({ error: err.message });
    } else {
      console.error(err);
      res.status(500).json({ error: 'Something went wrong loading that repository tree.' });
    }
  }
});

app.put('/repositories/:teamId/file-labels', async (req, res) => {
  try {
    const teamID = parseTeamId(req.params.teamId);
    const input = parseFileLabelInput(req.body);
    if (!teamID || !input) {
      res.status(400).json({ error: 'Enter a valid file path and category.' });
      return;
    }

    const repo = await db.orm.public.Repository.where({ teamID }).first();
    if (!repo) {
      res.status(404).json({ error: 'Repository not found' });
      return;
    }

    const tree = await readRepositoryTree(repo.url);
    if (!filePaths(tree.nodes).has(input.path)) {
      res.status(404).json({ error: 'File not found on the repository default branch.' });
      return;
    }

    await db.orm.public.RepositoryFileLabel.upsert({
      create: { teamID, ...input },
      update: { category: input.category },
    });
    res.json({ ...input, present: true });
  } catch (err) {
    if (err instanceof RepositoryTreeError) {
      res.status(err.status).json({ error: err.message });
    } else {
      console.error(err);
      res.status(500).json({ error: 'Something went wrong saving that file label.' });
    }
  }
});

app.delete('/repositories/:teamId/file-labels', async (req, res) => {
  try {
    const teamID = parseTeamId(req.params.teamId);
    const path = parseFilePath(req.query.path);
    if (!teamID || !path) {
      res.status(400).json({ error: 'Enter a valid file path.' });
      return;
    }

    const repo = await db.orm.public.Repository.where({ teamID }).first();
    if (!repo) {
      res.status(404).json({ error: 'Repository not found' });
      return;
    }

    const labels = db.orm.public.RepositoryFileLabel.where({ teamID, path });
    if (await labels.first()) await labels.delete();
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong removing that file label.' });
  }
});

app.put('/repositories/:teamId/directory-labels', async (req, res) => {
  try {
    const teamID = parseTeamId(req.params.teamId);
    const input = parseFileLabelInput(req.body);
    if (!teamID || !input) {
      res.status(400).json({ error: 'Enter a valid directory path and category.' });
      return;
    }

    const repo = await db.orm.public.Repository.where({ teamID }).first();
    if (!repo) {
      res.status(404).json({ error: 'Repository not found' });
      return;
    }

    const tree = await readRepositoryTree(repo.url);
    if (!directoryPaths(tree.nodes).has(input.path)) {
      res.status(404).json({ error: 'Directory not found on the repository default branch.' });
      return;
    }

    await db.orm.public.RepositoryDirectoryLabel.upsert({
      create: { teamID, ...input },
      update: { category: input.category },
    });
    res.json({ ...input, present: true });
  } catch (err) {
    if (err instanceof RepositoryTreeError) {
      res.status(err.status).json({ error: err.message });
    } else {
      console.error(err);
      res.status(500).json({ error: 'Something went wrong saving that directory label.' });
    }
  }
});

app.delete('/repositories/:teamId/directory-labels', async (req, res) => {
  try {
    const teamID = parseTeamId(req.params.teamId);
    const path = parseFilePath(req.query.path);
    if (!teamID || !path) {
      res.status(400).json({ error: 'Enter a valid directory path.' });
      return;
    }

    const repo = await db.orm.public.Repository.where({ teamID }).first();
    if (!repo) {
      res.status(404).json({ error: 'Repository not found' });
      return;
    }

    const labels = db.orm.public.RepositoryDirectoryLabel.where({ teamID, path });
    if (await labels.first()) await labels.delete();
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong removing that directory label.' });
  }
});

// Optional ?teamId= narrows to commits written by that team's students.
app.get('/commits', async (req, res) => {
  try {
    if (!req.query.teamId) {
      res.json(await db.orm.public.Commit.orderBy((c) => c.dateTime.desc()).all());
      return;
    }

    const teamID = Number(req.query.teamId);
    const commits = (await commitsForTeam(teamID)).commits;
    const commitHashes = new Set(commits.map((commit) => commit.commitHash));
    const [labels, directoryLabels, fileChanges] = await Promise.all([
      db.orm.public.RepositoryFileLabel.where({ teamID }).all(),
      db.orm.public.RepositoryDirectoryLabel.where({ teamID }).all(),
      commitHashes.size === 0
        ? Promise.resolve([])
        : db.orm.public.FileChange.where((change) => change.commitHash.in([...commitHashes])).all(),
    ]);
    const tagsByHash = commitTagsByHash(labels, directoryLabels, fileChanges);
    res.json(commits.map((commit) => ({ ...commit, tags: tagsByHash.get(commit.commitHash) ?? [] })));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get('/commits/:hash/files', async (req, res) => {
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
app.get('/github-app', (_req, res) => {
  res.json({ installUrl: installUrl() });
});

// Optional ?instructorId= narrows to one instructor's courses.
app.get('/courses', async (req, res) => {
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

app.post('/courses', async (req, res) => {
  try {
    res.status(201).json(await createCourse(req.body ?? {}));
  } catch (err) {
    sendError(res, err);
  }
});

// Links the org's repos (filtered by the course's name pattern) to the course.
app.post('/courses/:courseId/sync', async (req, res) => {
  try {
    res.json(await syncCourse(Number(req.params.courseId)));
  } catch (err) {
    sendError(res, err);
  }
});

// Starts a background ingest of every synced repo; poll the GET for progress.
app.post('/courses/:courseId/ingest', async (req, res) => {
  try {
    res.status(202).json(await startCourseIngest(Number(req.params.courseId)));
  } catch (err) {
    sendError(res, err);
  }
});

app.get('/courses/:courseId/ingest', (req, res) => {
  res.json(ingestStatus(Number(req.params.courseId)) ?? { status: 'idle' });
});

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => console.log(`API running on :${PORT}`));
