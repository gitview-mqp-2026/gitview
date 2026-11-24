import assert from 'node:assert/strict';
import test from 'node:test';
import { assertRepositoryCourse, CourseError } from './courses.js';

test('assertRepositoryCourse allows saving once without moving a repository between courses', () => {
  assert.doesNotThrow(() => assertRepositoryCourse(null, 7));
  assert.doesNotThrow(() => assertRepositoryCourse(7, 7));
  assert.throws(
    () => assertRepositoryCourse(8, 7),
    (error) => error instanceof CourseError && error.status === 409,
  );
});
