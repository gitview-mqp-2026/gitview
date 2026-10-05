import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { db } from './prisma/db.js';
import { analyzeRepo, AnalyzeError, RepoUrlError } from './lib/analyze.js';
import { countPullRequestsMerged } from './lib/stats.js';

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
app.get('/api/repositories', async (_req, res) => {
  try {
    const [repos, students, commits] = await Promise.all([
      db.orm.public.Repository.all(),
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

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => console.log(`API running on :${PORT}`));
