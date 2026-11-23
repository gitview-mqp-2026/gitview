import { DEFAULT_WEIGHTS } from './contribution.js';
import { FILE_CATEGORIES, normalizeFileCategory, parseTeamId, type FileCategory } from './fileLabels.js';

// Per-course contribution weights: whole-number percents, one per category, that add up to exactly 100.
export type WeightsByCategory = Record<FileCategory, number>;

// Same rule as team ids: a positive decimal integer.
export const parseCourseId = parseTeamId;

export type ParsedWeights = { ok: true; weights: WeightsByCategory } | { ok: false; error: string };

// Validates an instructor's submission. Every category must be present and no unknown one may appear, each a
// whole number from 0 to 100, and the total must be exactly 100: asking the instructor to make it add up is
// clearer than quietly rescaling what they typed.
export function parseWeightsInput(body: unknown): ParsedWeights {
  const submitted = body && typeof body === 'object' ? Reflect.get(body, 'weights') : undefined;
  if (!submitted || typeof submitted !== 'object' || Array.isArray(submitted)) {
    return { ok: false, error: 'Send the weights as an object of category percentages.' };
  }

  const unknown = Object.keys(submitted).filter((key) => !FILE_CATEGORIES.some((category) => category === key));
  if (unknown.length > 0) return { ok: false, error: `Unknown categories: ${unknown.join(', ')}.` };

  const weights = {} as WeightsByCategory;
  for (const category of FILE_CATEGORIES) {
    const value: unknown = Reflect.get(submitted, category);
    if (value === undefined) return { ok: false, error: `Missing a weight for ${category}.` };
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 100) {
      return { ok: false, error: `The weight for ${category} must be a whole number from 0 to 100.` };
    }
    weights[category] = value;
  }

  const total = FILE_CATEGORIES.reduce((sum, category) => sum + weights[category], 0);
  if (total !== 100) return { ok: false, error: `Weights must add up to 100% (they add up to ${total}%).` };
  return { ok: true, weights };
}

// The weights in effect for a course. A course with no stored rows has never been customized, so it follows the
// defaults in code, and a change to those defaults reaches every course that never customized.
export function weightsFromRows(rows: readonly { category: string; percent: number }[]): {
  weights: WeightsByCategory;
  isDefault: boolean;
} {
  if (rows.length === 0) return { weights: { ...DEFAULT_WEIGHTS }, isDefault: true };
  const weights = Object.fromEntries(FILE_CATEGORIES.map((category) => [category, 0])) as WeightsByCategory;
  for (const row of rows) {
    const category = normalizeFileCategory(row.category);
    if (category) weights[category] = row.percent;
  }
  return { weights, isDefault: false };
}
