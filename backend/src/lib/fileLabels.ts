export const FILE_CATEGORIES = [
  'Database',
  'Routes/Endpoints',
  'Templates/components',
  'Forms',
  'Styling',
  'Testing',
  'App-setup',
] as const;

export type FileCategory = (typeof FILE_CATEGORIES)[number];

export interface FileLabelInput {
  path: string;
  category: FileCategory;
}

export function parseTeamId(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  const teamID = Number(value);
  return Number.isSafeInteger(teamID) && teamID > 0 ? teamID : null;
}

export function isFileCategory(value: unknown): value is FileCategory {
  return typeof value === 'string' && FILE_CATEGORIES.some((allowed) => allowed === value);
}

export function commitTagsByHash(
  labels: readonly { path: string; category: string }[],
  fileChanges: readonly { commitHash: string; filePath: string }[],
): Map<string, FileCategory[]> {
  const categoryByPath = new Map(
    labels.filter((label) => isFileCategory(label.category)).map((label) => [label.path, label.category as FileCategory]),
  );
  const result = new Map<string, FileCategory[]>();

  for (const change of fileChanges) {
    // shortcut: labels match recorded paths exactly, follow Git rename history when categories must span renames.
    const category = categoryByPath.get(change.filePath);
    if (!category) continue;
    const categories = result.get(change.commitHash) ?? [];
    if (!categories.includes(category)) categories.push(category);
    result.set(change.commitHash, categories);
  }

  for (const categories of result.values()) {
    categories.sort((a, b) => FILE_CATEGORIES.indexOf(a) - FILE_CATEGORIES.indexOf(b));
  }
  return result;
}

export function parseFilePath(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 4096 || value.includes('\0')) {
    return null;
  }

  const segments = value.split('/');
  if (value.startsWith('/') || value.endsWith('/') || segments.some((part) => !part || part === '.' || part === '..')) {
    return null;
  }

  return value;
}

export function parseFileLabelInput(value: unknown): FileLabelInput | null {
  if (!value || typeof value !== 'object') return null;

  const path = parseFilePath(Reflect.get(value, 'path'));
  const category = Reflect.get(value, 'category');
  if (!path || !isFileCategory(category)) return null;

  return { path, category };
}
