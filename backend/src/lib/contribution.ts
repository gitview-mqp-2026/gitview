import { FILE_CATEGORIES, type FileCategory } from './fileLabels.js';

// Fair-Share Index (FSI): how much of an equal share of the team's work each member delivered, weighted by
// category. 1.00 = exactly their fair share. Pure functions only; callers load the rows and the label resolver.

// Percentages that sum to 100. A course with no saved weights uses these.
export type CategoryWeights = Readonly<Partial<Record<FileCategory, number>>>;

export const DEFAULT_WEIGHTS: Readonly<Record<FileCategory, number>> = {
  Database: 25,
  'Routes/Endpoints': 25,
  'Templates/Components': 15,
  Forms: 10,
  'App-setup': 10,
  Testing: 10,
  Styling: 5,
};

// A member's per-category index is capped here so extra work in one category cannot hide a gap in another.
export const CONTRIBUTION_CAP = 1.25;
export const THRESHOLDS = { green: 0.85, yellow: 0.6 } as const;

// Below either limit the team has too little labeled work for a fair judgment, so nobody gets a color.
export const MIN_COVERAGE = 0.5;
export const MIN_TEAM_LINES = 100;

const DELETION_WEIGHT = 0.5;
const FULL_CREDIT_LINES = 200;
const OVERFLOW_CREDIT = 0.25;

// Generated, vendored or build output: never counts as effort, and never counts toward labeling coverage.
const EXCLUDED_PATHS: readonly RegExp[] = [
  /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|Gemfile\.lock|poetry\.lock|Cargo\.lock|composer\.lock)$/,
  /(^|\/)(node_modules|dist|build|vendor|coverage|\.next)\//,
  /\.min\.(js|css)$/,
  /\.map$/,
];

export function isExcludedPath(filePath: string): boolean {
  return EXCLUDED_PATHS.some((pattern) => pattern.test(filePath));
}

// Additions plus half-weighted deletions, with diminishing returns on a single file in a single commit so a
// pasted or generated blob cannot dominate: full credit up to 200 lines, a quarter beyond that.
export function effectiveLines(additions: number, deletions: number): number {
  const raw = additions + DELETION_WEIGHT * deletions;
  return raw <= FULL_CREDIT_LINES ? raw : FULL_CREDIT_LINES + OVERFLOW_CREDIT * (raw - FULL_CREDIT_LINES);
}

export type ContributionLevel = 'green' | 'yellow' | 'red' | 'gray';
export type GrayReason = 'low-coverage' | 'low-data' | 'no-labeled-work';

export function levelFor(index: number): Exclude<ContributionLevel, 'gray'> {
  if (index >= THRESHOLDS.green) return 'green';
  if (index >= THRESHOLDS.yellow) return 'yellow';
  return 'red';
}

export interface ContributionInput {
  members: readonly { userID: number }[];
  commits: readonly { commitHash: string; studentID: number; isMerge: number }[];
  fileChanges: readonly { commitHash: string; filePath: string; additions: number; deletions: number }[];
  resolve: (filePath: string) => FileCategory | null;
  weights?: CategoryWeights;
}

export interface CategoryBreakdown {
  category: FileCategory;
  // The configured percent, and whether the category counted: it is dropped when the team did no work in it
  // (or its weight is 0), and the remaining weights are scaled back up to 100%.
  weight: number;
  included: boolean;
  effort: number;
  teamEffort: number;
  share: number;
  index: number;
}

export interface MemberContribution {
  userID: number;
  index: number | null;
  level: ContributionLevel;
  reason: GrayReason | null;
  categories: CategoryBreakdown[];
}

export interface LabelingCoverage {
  labeledLines: number;
  totalLines: number;
  // 0 to 1; 1 when the team has no scorable lines at all, so an empty repository is not reported as unlabeled.
  ratio: number;
}

export interface TeamContribution {
  coverage: LabelingCoverage;
  members: Map<number, MemberContribution>;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

// Authors are the team's members; merge commits and excluded files are skipped. Files with no label are left
// out of every score but still count against coverage.
export function labelingCoverage(
  input: Pick<ContributionInput, 'commits' | 'fileChanges' | 'resolve'>,
): LabelingCoverage {
  const authored = new Set<string>();
  for (const commit of input.commits) if (!commit.isMerge) authored.add(commit.commitHash);
  let labeledLines = 0;
  let totalLines = 0;
  for (const change of input.fileChanges) {
    if (!authored.has(change.commitHash) || isExcludedPath(change.filePath)) continue;
    const lines = effectiveLines(change.additions, change.deletions);
    totalLines += lines;
    if (input.resolve(change.filePath)) labeledLines += lines;
  }
  return { labeledLines, totalLines, ratio: totalLines === 0 ? 1 : labeledLines / totalLines };
}

export function contributionIndex(input: ContributionInput): TeamContribution {
  const weights = input.weights ?? DEFAULT_WEIGHTS;
  const memberIds = new Set(input.members.map((member) => member.userID));
  const teamSize = memberIds.size;

  const authorByHash = new Map<string, number>();
  for (const commit of input.commits) {
    if (!commit.isMerge && memberIds.has(commit.studentID)) authorByHash.set(commit.commitHash, commit.studentID);
  }

  const effortByMember = new Map<number, Map<FileCategory, number>>();
  const teamEffort = new Map<FileCategory, number>();
  for (const change of input.fileChanges) {
    const author = authorByHash.get(change.commitHash);
    if (author === undefined || isExcludedPath(change.filePath)) continue;
    const category = input.resolve(change.filePath);
    if (!category) continue;
    const lines = effectiveLines(change.additions, change.deletions);
    const own = effortByMember.get(author) ?? new Map<FileCategory, number>();
    own.set(category, (own.get(category) ?? 0) + lines);
    effortByMember.set(author, own);
    teamEffort.set(category, (teamEffort.get(category) ?? 0) + lines);
  }

  const coverage = labelingCoverage({
    commits: input.commits.filter((commit) => memberIds.has(commit.studentID)),
    fileChanges: input.fileChanges,
    resolve: input.resolve,
  });

  const active = FILE_CATEGORIES.filter((category) => (teamEffort.get(category) ?? 0) > 0 && (weights[category] ?? 0) > 0);
  const activeWeightTotal = active.reduce((sum, category) => sum + (weights[category] ?? 0), 0);
  const teamLabeledLines = [...teamEffort.values()].reduce((sum, lines) => sum + lines, 0);

  let teamGray: GrayReason | null = null;
  if (active.length === 0) teamGray = 'no-labeled-work';
  else if (coverage.ratio < MIN_COVERAGE) teamGray = 'low-coverage';
  else if (teamLabeledLines < MIN_TEAM_LINES) teamGray = 'low-data';

  const members = new Map<number, MemberContribution>();
  for (const userID of memberIds) {
    const own = effortByMember.get(userID);
    let total = 0;
    const categories = FILE_CATEGORIES.map((category): CategoryBreakdown => {
      const weight = weights[category] ?? 0;
      const included = active.includes(category);
      const all = teamEffort.get(category) ?? 0;
      const effort = own?.get(category) ?? 0;
      const share = included ? effort / all : 0;
      const index = included ? Math.min(teamSize * share, CONTRIBUTION_CAP) : 0;
      if (included) total += (weight / activeWeightTotal) * index;
      return { category, weight, included, effort, teamEffort: all, share, index };
    });

    if (active.length === 0) {
      members.set(userID, { userID, index: null, level: 'gray', reason: teamGray, categories });
      continue;
    }
    // Round first so the color always agrees with the number a person sees.
    const index = round2(total);
    members.set(userID, {
      userID,
      index,
      level: teamGray ? 'gray' : levelFor(index),
      reason: teamGray,
      categories,
    });
  }

  return { coverage, members };
}
