import assert from 'node:assert/strict';
import test from 'node:test';
import {
  commitTagsByHash,
  FILE_CATEGORIES,
  normalizeFileCategory,
  parseFileLabelInput,
  parseFilePath,
  parseTeamId,
} from './fileLabels.js';

test('parseFileLabelInput accepts only known categories and normalized Git paths', () => {
  assert.deepEqual(parseFileLabelInput({ path: 'frontend/src/components/App.jsx', category: 'Templates/Components' }), {
    path: 'frontend/src/components/App.jsx',
    category: 'Templates/Components',
  });
  assert.equal(parseFileLabelInput({ path: 'frontend/src/App.jsx', category: 'Templates/components' }), null);
  assert.equal(parseFileLabelInput({ path: 'frontend/src/App.jsx', category: 'Unknown' }), null);
  assert.equal(parseFileLabelInput({ path: '../frontend/App.jsx', category: 'Styling' }), null);
  assert.equal(FILE_CATEGORIES.length, 7);
});

test('parseFilePath rejects roots and traversal without changing valid names', () => {
  assert.equal(parseFilePath('src/routes/index.ts'), 'src/routes/index.ts');
  assert.equal(parseFilePath('src\\routes.ts'), 'src\\routes.ts');
  for (const value of ['', '/', '/src.ts', 'src/', 'src//routes.ts', 'src/./routes.ts', 'src/../routes.ts', 'bad\0path']) {
    assert.equal(parseFilePath(value), null);
  }
});

test('parseTeamId accepts positive decimal ids only', () => {
  assert.equal(parseTeamId('12'), 12);
  for (const value of ['0', '-1', '1.5', 'team', '', undefined]) assert.equal(parseTeamId(value), null);
});

test('commitTagsByHash derives distinct, ordered categories from changed file labels', () => {
  const hash = 'a'.repeat(40);
  assert.deepEqual(
    commitTagsByHash(
      [
        { path: 'src/App.test.jsx', category: 'Testing' },
        { path: 'schema.sql', category: 'Database' },
        { path: 'legacy.txt', category: 'Legacy' },
      ],
      [],
      [
        { commitHash: hash, filePath: 'src/App.test.jsx' },
        { commitHash: hash, filePath: 'schema.sql' },
        { commitHash: hash, filePath: 'schema.sql' },
        { commitHash: hash, filePath: 'legacy.txt' },
        { commitHash: 'b'.repeat(40), filePath: 'unlabeled.txt' },
      ],
    ).get(hash),
    ['Database', 'Testing'],
  );
});

test('commit tags use file overrides and the nearest labeled directory', () => {
  const hash = 'b'.repeat(40);
  assert.deepEqual(
    commitTagsByHash(
      [{ path: 'src/routes/form.ts', category: 'Forms' }],
      [
        { path: 'src', category: 'App-setup' },
        { path: 'src/routes', category: 'Routes/Endpoints' },
      ],
      [
        { commitHash: hash, filePath: 'src/index.ts' },
        { commitHash: hash, filePath: 'src/routes/api.ts' },
        { commitHash: hash, filePath: 'src/routes/form.ts' },
      ],
    ).get(hash),
    ['Routes/Endpoints', 'Forms', 'App-setup'],
  );
});

test('labels saved under a renamed category still resolve to the current name', () => {
  const hash = 'c'.repeat(40);
  assert.equal(normalizeFileCategory('Templates/components'), 'Templates/Components');
  assert.equal(normalizeFileCategory('Templates/Components'), 'Templates/Components');
  assert.equal(normalizeFileCategory('toString'), null);
  assert.deepEqual(
    commitTagsByHash(
      [{ path: 'src/App.jsx', category: 'Templates/components' }],
      [],
      [{ commitHash: hash, filePath: 'src/App.jsx' }],
    ).get(hash),
    ['Templates/Components'],
  );
});
