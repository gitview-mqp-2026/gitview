import { db } from '../prisma/db.js';
import {
  contributionIndex,
  labelingCoverage,
  unlabeledFolders,
  type CategoryWeights,
  type ContributionInput,
  type LabelingCoverage,
  type TeamContribution,
  type UnlabeledFolder,
} from './contribution.js';
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

// Everything needed to score or measure each team, keyed by teamID: its members, their commits and file
// changes, and a resolver built from that team's own labels. Teams are kept apart; a team with no students
// still gets (empty) inputs. Nothing is stored: file labels change whenever an instructor relabels the
// project tree, so scores and coverage are computed on request from these inputs.
async function loadTeamInputs(teamIDs: readonly number[]): Promise<Map<number, ContributionInput>> {
  const ids = [...new Set(teamIDs)];
  const inputs = new Map<number, ContributionInput>();
  if (ids.length === 0) return inputs;

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
    inputs.set(teamID, {
      members: studentsByTeam.get(teamID) ?? [],
      commits: commitsByTeam.get(teamID) ?? [],
      fileChanges: changesByTeam.get(teamID) ?? [],
      resolve: categoryResolver(fileLabelsByTeam.get(teamID) ?? [], directoryLabelsByTeam.get(teamID) ?? []),
    });
  }
  return inputs;
}

// Contribution results for each team, keyed by teamID.
export async function contributionForTeams(
  teamIDs: readonly number[],
  weights?: CategoryWeights,
): Promise<Map<number, TeamContribution>> {
  const results = new Map<number, TeamContribution>();
  for (const [teamID, input] of await loadTeamInputs(teamIDs)) {
    results.set(teamID, contributionIndex({ ...input, weights }));
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

export interface TeamLabelCoverage extends LabelingCoverage {
  unlabeledFolders: UnlabeledFolder[];
}

// How much of a team's work sits under a file or folder label, and where the unlabeled work is. Built from
// the same inputs as the scores, so what the tree reports is exactly what the scores can and can't count.
export async function teamLabelCoverage(teamID: number): Promise<TeamLabelCoverage> {
  const input = (await loadTeamInputs([teamID])).get(teamID)!;
  return { ...labelingCoverage(input), unlabeledFolders: unlabeledFolders(input) };
}
