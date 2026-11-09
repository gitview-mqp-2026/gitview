import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { authEnv } from './analyze.js';

test('authEnv passes the token through git env config, never the URL or argv', () => {
  const env = authEnv('ghs_example');
  assert.equal(env['GIT_CONFIG_COUNT'], '1');
  assert.equal(env['GIT_CONFIG_KEY_0'], 'http.https://github.com/.extraheader');
  const basic = Buffer.from('x-access-token:ghs_example').toString('base64');
  assert.equal(env['GIT_CONFIG_VALUE_0'], `Authorization: Basic ${basic}`);
});

test('every git call in analyzeRepo forwards the installation token', () => {
  const source = readFileSync(new URL('./analyze.ts', import.meta.url), 'utf8');
  const calls = source.split('\n').filter((line) => /await git\(\[/.test(line) && !/symbolic-ref/.test(line));
  assert.ok(calls.length >= 3);
  for (const line of calls) assert.match(line, /, token\)/, `missing token: ${line.trim()}`);
});
