import { db } from '../prisma/db.js';
import { contributionIndex, type CategoryWeights, type TeamContribution } from './contribution.js';
import { categoryResolver } from './fileLabels.js';

// Keeps each IN (...) list well under Postgres's 65,535 bind-parameter limit on large courses.
const HASH_CHUNK_SIZE = 5000;

function groupBy<T, K>(rows: readonly T[], key: (row: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const row of rows) {
    const group = groups.get(key(row));
    if (group) group.push(row);
    else groups.set(key(row), [row]);
  }
  return groups;
}

async function fileChangesForCommits(hashes: readonly string[]) {
  const chunks: string[][] = [];
  for (let i = 0; i < hashes.length; i += HASH_CHUNK_SIZE) chunks.push(hashes.slice(i, i + HASH_CHUNK_SIZE));
  const rows = await Promise.all(
    chunks.map((chunk) => db.orm.public.FileChange.where((change) => change.commitHash.in(chunk)).all()),
  );
  return rows.flat();
}

// Contribution results for each team, keyed by teamID. Teams are scored on their own work and their own labels;
// a team with no students still gets an (empty) result. Scores are computed on request, not stored, because
// file labels change whenever an instructor relabels the project tree.
export async function contributionForTeams(
  teamIDs: readonly number[],
  weights?: CategoryWeights,
): Promise<Map<number, TeamContribution>> {
  const ids = [...new Set(teamIDs)];
  const results = new Map<number, TeamContribution>();
  if (ids.length === 0) return results;

  const [students, fileLabels, directoryLabels] = await Promise.all([
    db.orm.public.Student.where((student) => student.teamID.in(ids)).all(),
    db.orm.public.RepositoryFileLabel.where((label) => label.teamID.in(ids)).all(),
    db.orm.public.RepositoryDirectoryLabel.where((label) => label.teamID.in(ids)).all(),
  ]);
  const studentIds = students.map((student) => student.userID);
  const commits = studentIds.length === 0
    ? []
    : await db.orm.public.Commit.where((commit) => commit.studentID.in(studentIds)).all();
  const fileChanges = commits.length === 0 ? [] : await fileChangesForCommits(commits.map((c) => c.commitHash));

  const teamByStudent = new Map(students.map((student) => [student.userID, student.teamID]));
  const teamByCommit = new Map(commits.map((commit) => [commit.commitHash, teamByStudent.get(commit.studentID)]));
  const studentsByTeam = groupBy(students, (student) => student.teamID);
  const commitsByTeam = groupBy(commits, (commit) => teamByStudent.get(commit.studentID));
  const changesByTeam = groupBy(fileChanges, (change) => teamByCommit.get(change.commitHash));
  const fileLabelsByTeam = groupBy(fileLabels, (label) => label.teamID);
  const directoryLabelsByTeam = groupBy(directoryLabels, (label) => label.teamID);

  for (const teamID of ids) {
    results.set(
      teamID,
      contributionIndex({
        members: studentsByTeam.get(teamID) ?? [],
        commits: commitsByTeam.get(teamID) ?? [],
        fileChanges: changesByTeam.get(teamID) ?? [],
        resolve: categoryResolver(fileLabelsByTeam.get(teamID) ?? [], directoryLabelsByTeam.get(teamID) ?? []),
        weights,
      }),
    );
  }
  return results;
}

export async function teamContribution(teamID: number, weights?: CategoryWeights): Promise<TeamContribution> {
  return (await contributionForTeams([teamID], weights)).get(teamID)!;
}

// Every team in a course in one pass: the roster page needs all of them at once, and querying per team
// would repeat the same four lookups for each repository.
export async function courseContribution(courseID: number, weights?: CategoryWeights): Promise<Map<number, TeamContribution>> {
  const repositories = await db.orm.public.Repository.where({ courseID }).all();
  return contributionForTeams(repositories.map((repository) => repository.teamID), weights);
}
