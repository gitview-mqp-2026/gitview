import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { gitLogArgs, parseGitLogOutput, readGitLog, renamedPath } from './gitLog.js';

test('renamedPath resolves every way git numstat writes a rename', () => {
  assert.equal(renamedPath('app/config.py => config.py'), 'config.py');
  assert.equal(renamedPath('Dockerfile => PLAapp/Dockerfile'), 'PLAapp/Dockerfile');
  assert.equal(renamedPath('images/{SystemLevelDesign.png => SystemLevelUML.png}'), 'images/SystemLevelUML.png');
  assert.equal(renamedPath('app/{auth => userInstructor}/templates/login.html'), 'app/userInstructor/templates/login.html');
  // One side empty leaves a stray slash that must not survive.
  assert.equal(renamedPath('app/{auth => }/templates/base.html'), 'app/templates/base.html');
  assert.equal(renamedPath('app/{ => errors}/templates/404error.html'), 'app/errors/templates/404error.html');
  assert.equal(renamedPath('{ => src}/index.js'), 'src/index.js');
  assert.equal(renamedPath('{old => }/index.js'), 'index.js');
});

test('renamedPath leaves ordinary paths alone', () => {
  for (const path of ['src/app.js', 'README.md', 'a b/c d.txt', 'dir/with=>no-spaces/file.txt', 'weird{name}.txt']) {
    assert.equal(renamedPath(path), path);
  }
});

test('gitLogArgs asks for whitespace-insensitive counts and explicit rename detection', () => {
  const args = gitLogArgs();
  assert.ok(args.includes('-w'));
  assert.ok(args.includes('-M'));
  assert.ok(args.includes('--numstat'));
  assert.ok(!args.some((arg) => arg.startsWith('--max-count')));
  assert.ok(gitLogArgs(25).includes('--max-count=25'));
});

test('parseGitLogOutput reads renames, binary files and multi-line bodies', () => {
  const hash = 'c'.repeat(40);
  const raw = [
    '--GITVIEW-COMMIT--',
    hash,
    'p'.repeat(40),
    'Ada Lovelace',
    'ADA@Example.com',
    '1700000000',
    'Ada Lovelace',
    'HEAD -> main',
    'Move templates',
    '--GITVIEW-BODY--',
    'First body line',
    'second line',
    '--GITVIEW-BODY-END--',
    '',
    '21\t1\tapp/{auth => }/templates/base.html',
    '-\t-\tlogo.png',
    '0\t0\tapp/config.py => config.py',
    '',
  ].join('\n');

  const [commit] = parseGitLogOutput(raw);
  assert.equal(commit.commitHash, hash);
  assert.equal(commit.authorEmail, 'ada@example.com');
  assert.equal(commit.committedAtMs, 1_700_000_000_000);
  assert.equal(commit.body, 'First body line\nsecond line');
  assert.deepEqual(commit.fileChanges, [
    { filePath: 'app/templates/base.html', additions: 21, deletions: 1 },
    { filePath: 'logo.png', additions: 0, deletions: 0 },
    { filePath: 'config.py', additions: 0, deletions: 0 },
  ]);
});

// Real repositories, so the test shows what git reports with these flags rather than what we assume it does.
function git(cwd: string, ...args: string[]) {
  execFileSync('git', args, { cwd, stdio: 'pipe' });
}

function withRepo(run: (dir: string) => void) {
  const dir = mkdtempSync(join(tmpdir(), 'gitview-gitlog-'));
  try {
    git(dir, 'init', '--quiet', '--initial-branch=main');
    git(dir, 'config', 'user.name', 'Test Author');
    git(dir, 'config', 'user.email', 'test@example.com');
    git(dir, 'config', 'commit.gpgsign', 'false');
    run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const commitAll = (dir: string, message: string) => {
  git(dir, 'add', '-A');
  git(dir, 'commit', '--quiet', '-m', message);
};

test('readGitLog ignores whitespace-only edits', () => {
  withRepo((dir) => {
    writeFileSync(join(dir, 'a.js'), 'function f() {\nreturn 1;\n}\n');
    commitAll(dir, 'add');
    writeFileSync(join(dir, 'a.js'), 'function f() {\n    return 1;\n}\n'); // re-indented only
    commitAll(dir, 'reindent');
    writeFileSync(join(dir, 'a.js'), 'function f() {\n    return 2;\n}\n'); // a real change
    commitAll(dir, 'change');

    const [change, reindent, add] = readGitLog(dir);
    assert.deepEqual(add.fileChanges, [{ filePath: 'a.js', additions: 3, deletions: 0 }]);
    assert.deepEqual(reindent.fileChanges, []); // git drops files whose only change is whitespace
    assert.deepEqual(change.fileChanges, [{ filePath: 'a.js', additions: 1, deletions: 1 }]);
  });
});

test('readGitLog records a move as the new path even when diff.renames is turned off', () => {
  withRepo((dir) => {
    git(dir, 'config', 'diff.renames', 'false'); // would hide renames if we relied on the default
    mkdirSync(join(dir, 'app/auth'), { recursive: true });
    const body = Array.from({ length: 30 }, (_, i) => `line ${i}`).join('\n') + '\n';
    writeFileSync(join(dir, 'app/auth/login.html'), body);
    commitAll(dir, 'add');
    mkdirSync(join(dir, 'app/users'), { recursive: true });
    renameSync(join(dir, 'app/auth/login.html'), join(dir, 'app/users/login.html'));
    commitAll(dir, 'move');

    const [move] = readGitLog(dir);
    assert.deepEqual(move.fileChanges, [{ filePath: 'app/users/login.html', additions: 0, deletions: 0 }]);
  });
});

test('readGitLog counts a moved-and-edited file once, under its new path', () => {
  withRepo((dir) => {
    const body = Array.from({ length: 30 }, (_, i) => `line ${i}`).join('\n') + '\n';
    writeFileSync(join(dir, 'old.txt'), body);
    commitAll(dir, 'add');
    git(dir, 'mv', 'old.txt', 'new.txt');
    writeFileSync(join(dir, 'new.txt'), body.replace('line 3\n', 'line three\n'));
    commitAll(dir, 'move and edit');

    const [move] = readGitLog(dir);
    assert.deepEqual(move.fileChanges, [{ filePath: 'new.txt', additions: 1, deletions: 1 }]);
  });
});
