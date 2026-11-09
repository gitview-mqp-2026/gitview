export const FILE_CATEGORIES = [
  'Database',
  'Routes/Endpoints',
  'Templates/Components',
  'Forms',
  'Styling',
  'Testing',
  'App-setup',
] as const;

export type FileCategory = (typeof FILE_CATEGORIES)[number];

// Labels saved before a category was renamed keep their old stored value; they read as the new name.
const LEGACY_CATEGORY_ALIASES: Readonly<Record<string, FileCategory>> = {
  'Templates/components': 'Templates/Components',
};

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

// Current category for a stored value, following renames; null when it is not a known category.
export function normalizeFileCategory(value: string): FileCategory | null {
  if (isFileCategory(value)) return value;
  return Object.hasOwn(LEGACY_CATEGORY_ALIASES, value) ? LEGACY_CATEGORY_ALIASES[value] : null;
}

export function commitTagsByHash(
  fileLabels: readonly { path: string; category: string }[],
  directoryLabels: readonly { path: string; category: string }[],
  fileChanges: readonly { commitHash: string; filePath: string }[],
): Map<string, FileCategory[]> {
  const fileCategoryByPath = new Map<string, FileCategory>();
  for (const label of fileLabels) {
    const category = normalizeFileCategory(label.category);
    if (category) fileCategoryByPath.set(label.path, category);
  }
  const directoryCategoryByPath = new Map<string, FileCategory>();
  for (const label of directoryLabels) {
    const category = normalizeFileCategory(label.category);
    if (category) directoryCategoryByPath.set(label.path, category);
  }
  const result = new Map<string, FileCategory[]>();

  for (const change of fileChanges) {
    // shortcut: labels match recorded paths exactly, follow Git rename history when categories must span renames.
    let category = fileCategoryByPath.get(change.filePath);
    let parentEnd = change.filePath.lastIndexOf('/');
    while (!category && parentEnd !== -1) {
      category = directoryCategoryByPath.get(change.filePath.slice(0, parentEnd));
      parentEnd = change.filePath.lastIndexOf('/', parentEnd - 1);
    }
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
