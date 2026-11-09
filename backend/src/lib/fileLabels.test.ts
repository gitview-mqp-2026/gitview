import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FILE_CATEGORIES,
  parseFileLabelInput,
  parseFilePath,
  parseTeamId,
} from './fileLabels.js';

test('parseFileLabelInput accepts only known categories and normalized Git paths', () => {
  assert.deepEqual(parseFileLabelInput({ path: 'frontend/src/components/App.jsx', category: 'Templates/components' }), {
    path: 'frontend/src/components/App.jsx',
    category: 'Templates/components',
  });
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
