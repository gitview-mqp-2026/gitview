import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  MAX_TREE_ENTRIES,
  directoryPaths,
  filePaths,
  parseGitTree,
  readRepositoryTreeFromMirror,
  RepositoryTreeError,
} from './repositoryTree.js';

const HASH = '0123456789012345678901234567890123456789';
const record = (type: 'tree' | 'blob' | 'commit', path: string): string =>
  `${type === 'tree' ? '040000' : type === 'commit' ? '160000' : '100644'} ${type} ${HASH}\t${path}\0`;

test('parseGitTree nests entries and sorts directories before files', () => {
  const nodes = parseGitTree([
    record('blob', 'z.txt'),
    record('tree', 'src'),
    record('blob', 'src/file with spaces.ts'),
    record('tree', 'src/nested'),
    record('blob', 'src/nested/line\nbreak.txt'),
    record('commit', 'vendor'),
  ].join(''));

  assert.deepEqual(nodes.map((node) => [node.kind, node.name]), [
    ['directory', 'src'],
    ['submodule', 'vendor'],
    ['file', 'z.txt'],
  ]);
  const src = nodes[0];
  assert.equal(src?.kind, 'directory');
  if (src?.kind === 'directory') {
    assert.deepEqual(src.children.map((node) => node.name), ['nested', 'file with spaces.ts']);
    const nested = src.children[0];
    assert.equal(nested?.kind, 'directory');
    if (nested?.kind === 'directory') assert.equal(nested.children[0]?.name, 'line\nbreak.txt');
  }

  const files = filePaths(nodes);
  assert.equal(files.has('src'), false);
  assert.equal(files.has('vendor'), false);
  assert.equal(files.has('z.txt'), true);
  assert.equal(files.has('src/file with spaces.ts'), true);
  assert.equal(files.has('src/nested/line\nbreak.txt'), true);

  assert.deepEqual([...directoryPaths(nodes)].sort(), ['src', 'src/nested']);
});

test('parseGitTree rejects malformed and oversized output', () => {
  assert.throws(() => parseGitTree('not a tree record\0'), RepositoryTreeError);
  const oversized = Array.from({ length: MAX_TREE_ENTRIES + 1 }, (_, index) => record('blob', `f${index}`)).join('');
  assert.throws(
    () => parseGitTree(oversized),
    (error) => error instanceof RepositoryTreeError && error.status === 413,
  );
});

test('readRepositoryTreeFromMirror follows a default branch not named main', async () => {
  const root = mkdtempSync(join(tmpdir(), 'gitview-tree-'));
  const mirror = join(root, 'mirror.git');
  try {
    const bareGit = (args: string[], input?: string): string => execFileSync(
      'git',
      ['--git-dir', mirror, ...args],
      { encoding: 'utf8', input },
    ).trim();
    execFileSync('git', ['init', '--bare', '--quiet', '--initial-branch=trunk', mirror]);
    const blob = bareGit(['hash-object', '-w', '--stdin'], 'export {};\n');
    const srcTree = bareGit(['mktree'], `100644 blob ${blob}\tindex.ts\n`);
    const rootTree = bareGit(['mktree'], `040000 tree ${srcTree}\tsrc\n`);
    const commit = execFileSync('git', ['--git-dir', mirror, 'commit-tree', rootTree, '-m', 'Initial'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Test User',
        GIT_AUTHOR_EMAIL: 'test@example.com',
        GIT_COMMITTER_NAME: 'Test User',
        GIT_COMMITTER_EMAIL: 'test@example.com',
      },
    }).trim();
    bareGit(['update-ref', 'refs/heads/trunk', commit]);
    bareGit(['symbolic-ref', 'HEAD', 'refs/heads/trunk']);

    const tree = await readRepositoryTreeFromMirror(mirror);
    assert.equal(tree.branch, 'trunk');
    assert.match(tree.commitHash, /^[0-9a-f]{40}$/);
    assert.equal(tree.nodes[0]?.name, 'src');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
