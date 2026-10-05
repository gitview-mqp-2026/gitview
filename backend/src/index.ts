import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { db } from './prisma/db.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/repositories', async (_req, res) => {
  try {
    res.json(await db.orm.public.Repository.all());
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Optional ?teamId= narrows to commits written by that team's students.
app.get('/api/commits', async (req, res) => {
  try {
    const commits = await db.orm.public.Commit.orderBy((c) => c.dateTime.desc()).all();

    if (!req.query.teamId) {
      res.json(commits);
      return;
    }

    const students = await db.orm.public.Student.where({ teamID: Number(req.query.teamId) }).all();
    const studentIds = new Set(students.map((s) => s.userID));
    res.json(commits.filter((c) => studentIds.has(c.studentID)));
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
