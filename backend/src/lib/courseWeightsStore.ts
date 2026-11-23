import { Temporal } from 'temporal-polyfill';
import { db } from '../prisma/db.js';
import { DEFAULT_WEIGHTS } from './contribution.js';
import { CourseError } from './courses.js';
import { weightsFromRows, type WeightsByCategory } from './courseWeights.js';
import { FILE_CATEGORIES, type FileCategory } from './fileLabels.js';

export interface CourseWeightsState {
  weights: WeightsByCategory;
  // True while the course has never been customized and follows the defaults in code.
  isDefault: boolean;
  updatedAt: string | null;
  defaults: WeightsByCategory;
  categories: readonly FileCategory[];
}

const toIso = (value: unknown): string | null =>
  value === null || value === undefined ? null : value instanceof Date ? value.toISOString() : String(value);

async function requireCourse(courseID: number) {
  const course = await db.orm.public.Course.where({ courseID }).first();
  if (!course) throw new CourseError(404, 'Course not found');
  return course;
}

export async function getCourseWeights(courseID: number): Promise<CourseWeightsState> {
  const course = await requireCourse(courseID);
  const rows = await db.orm.public.CourseCategoryWeight.where({ courseID }).all();
  return {
    ...weightsFromRows(rows),
    updatedAt: toIso(course.weightsUpdatedAt),
    defaults: { ...DEFAULT_WEIGHTS },
    categories: FILE_CATEGORIES,
  };
}

// Replaces all of a course's weights at once. Everything happens in one transaction, and it checks its own
// result: .where().delete() removes a single row, so the old rows go with deleteAll(), and a save that does not
// end with exactly one row per category rolls back rather than leave a half-written set.
export async function saveCourseWeights(courseID: number, weights: WeightsByCategory): Promise<CourseWeightsState> {
  await requireCourse(courseID);
  await db.transaction(async (tx) => {
    await tx.orm.public.CourseCategoryWeight.where({ courseID }).deleteAll();
    for (const category of FILE_CATEGORIES) {
      await tx.orm.public.CourseCategoryWeight.create({ courseID, category, percent: weights[category] });
    }
    const stored = await tx.orm.public.CourseCategoryWeight.where({ courseID }).all();
    if (stored.length !== FILE_CATEGORIES.length) {
      throw new Error(`Expected ${FILE_CATEGORIES.length} stored weights for course ${courseID} but found ${stored.length}; rolled back.`);
    }
    await tx.orm.public.Course.where({ courseID }).update({ weightsUpdatedAt: Temporal.Now.instant() });
  });
  return getCourseWeights(courseID);
}

// Back to the defaults: removing the rows (and the timestamp) means the course follows the defaults again.
export async function resetCourseWeights(courseID: number): Promise<CourseWeightsState> {
  await requireCourse(courseID);
  await db.transaction(async (tx) => {
    await tx.orm.public.CourseCategoryWeight.where({ courseID }).deleteAll();
    if ((await tx.orm.public.CourseCategoryWeight.where({ courseID }).all()).length !== 0) {
      throw new Error(`Could not clear the weights for course ${courseID}; rolled back.`);
    }
    await tx.orm.public.Course.where({ courseID }).update({ weightsUpdatedAt: null });
  });
  return getCourseWeights(courseID);
}
