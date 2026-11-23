import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_WEIGHTS } from './contribution.js';
import { parseCourseId, parseWeightsInput, weightsFromRows } from './courseWeights.js';

const valid = { ...DEFAULT_WEIGHTS };
const submit = (weights: unknown) => parseWeightsInput({ weights });

test('parseWeightsInput accepts the defaults and any whole-number split totaling 100', () => {
  assert.deepEqual(submit(valid), { ok: true, weights: valid });
  const custom = { Database: 0, 'Routes/Endpoints': 40, 'Templates/Components': 30, Forms: 0, 'App-setup': 0, Testing: 30, Styling: 0 };
  assert.deepEqual(submit(custom), { ok: true, weights: custom });
});

test('parseWeightsInput requires the weights to add up to exactly 100', () => {
  assert.deepEqual(submit({ ...valid, Styling: 6 }), { ok: false, error: 'Weights must add up to 100% (they add up to 101%).' });
  assert.deepEqual(submit({ ...valid, Styling: 0 }), { ok: false, error: 'Weights must add up to 100% (they add up to 95%).' });
});

test('parseWeightsInput rejects fractions, negatives, over 100, strings and non-numbers', () => {
  for (const bad of [5.5, -5, 101, '5', null, NaN, Infinity, true]) {
    const result = submit({ ...valid, Styling: bad });
    assert.equal(result.ok, false, String(bad));
    if (!result.ok) assert.match(result.error, /Styling must be a whole number from 0 to 100/);
  }
});

test('parseWeightsInput rejects missing, unknown and legacy-spelled categories', () => {
  const { Styling: _removed, ...missing } = valid;
  assert.deepEqual(submit(missing), { ok: false, error: 'Missing a weight for Styling.' });
  assert.deepEqual(submit({ ...valid, Other: 0 }), { ok: false, error: 'Unknown categories: Other.' });
  // The old spelling is only understood when reading stored labels, never accepted as new input.
  const { 'Templates/Components': components, ...rest } = valid;
  assert.deepEqual(submit({ ...rest, 'Templates/components': components }), { ok: false, error: 'Unknown categories: Templates/components.' });
});

test('parseWeightsInput rejects bodies that are not an object of weights', () => {
  for (const body of [undefined, null, 'x', 5, [], {}, { weights: null }, { weights: [] }, { weights: 'x' }]) {
    const result = parseWeightsInput(body);
    assert.equal(result.ok, false, JSON.stringify(body));
    if (!result.ok) assert.equal(result.error, 'Send the weights as an object of category percentages.');
  }
});

test('weightsFromRows falls back to the defaults for a course that never customized', () => {
  const result = weightsFromRows([]);
  assert.equal(result.isDefault, true);
  assert.deepEqual(result.weights, DEFAULT_WEIGHTS);
  result.weights.Database = 99; // a caller changing its copy must not change the shared defaults
  assert.equal(DEFAULT_WEIGHTS.Database, 25);
});

test('weightsFromRows reads stored rows, zero-fills gaps and follows renamed categories', () => {
  const result = weightsFromRows([
    { category: 'Database', percent: 60 },
    { category: 'Templates/components', percent: 40 }, // saved before the category was renamed
    { category: 'NotACategory', percent: 90 },
  ]);
  assert.equal(result.isDefault, false);
  assert.equal(result.weights.Database, 60);
  assert.equal(result.weights['Templates/Components'], 40);
  assert.equal(result.weights.Testing, 0);
  assert.equal(Object.keys(result.weights).length, 7);
});

test('parseCourseId accepts positive decimal ids only', () => {
  assert.equal(parseCourseId('3'), 3);
  for (const value of ['0', '-1', '1.5', 'x', '', undefined]) assert.equal(parseCourseId(value), null);
});
