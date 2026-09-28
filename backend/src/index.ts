import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { db } from './prisma/db.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/repositories', async (_req, res) => {
  try {
    const repos = await db.orm.public.Repository.many();
    res.json(repos);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get('/api/commits', async (req, res) => {
  try {
    const repoId = req.query.repoId ? Number(req.query.repoId) : undefined;
    const commits = repoId
      ? await db.orm.public.Commit.where({ repositoryId: repoId }).many()
      : await db.orm.public.Commit.many();
    res.json(commits);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get('/api/commits/:hash/files', async (req, res) => {
  try {
    const files = await db.orm.public.FileChange
      .where({ commitHash: req.params.hash })
      .many();
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => console.log(`API running on :${PORT}`));
