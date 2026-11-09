import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { promisify } from 'node:util';
import { repositoryMirrorPath } from './repositoryMirror.js';

const run = promisify(execFile);
const GIT_TIMEOUT_MS = 30_000;
const GIT_MAX_BUFFER = 20 * 1024 * 1024;
export const MAX_TREE_ENTRIES = 10_000;

export type RepositoryTreeNode =
  | { kind: 'directory'; name: string; path: string; children: RepositoryTreeNode[] }
  | { kind: 'file' | 'submodule'; name: string; path: string };

export interface RepositoryTree {
  branch: string;
  commitHash: string;
  nodes: RepositoryTreeNode[];
}

export class RepositoryTreeError extends Error {
  constructor(public status: 409 | 413 | 422, message: string) {
    super(message);
  }
}

interface ParsedTreeEntry {
  kind: RepositoryTreeNode['kind'];
  path: string;
}

function compareNodes(a: RepositoryTreeNode, b: RepositoryTreeNode): number {
  if (a.kind === 'directory' && b.kind !== 'directory') return -1;
  if (a.kind !== 'directory' && b.kind === 'directory') return 1;
  return a.name.localeCompare(b.name);
}

export function parseGitTree(raw: string, limit = MAX_TREE_ENTRIES): RepositoryTreeNode[] {
  const records = raw.split('\0');
  if (records.at(-1) === '') records.pop();
  if (records.length > limit) {
    throw new RepositoryTreeError(413, `Repository has more than ${limit.toLocaleString()} tree entries.`);
  }

  const entries: ParsedTreeEntry[] = records.map((record) => {
    const separator = record.indexOf('\t');
    if (separator === -1) throw new RepositoryTreeError(422, 'Repository tree output was malformed.');

    const metadata = record.slice(0, separator).split(' ');
    const path = record.slice(separator + 1);
    const type = metadata[1];
    if (metadata.length !== 3 || !path || (type !== 'tree' && type !== 'blob' && type !== 'commit')) {
      throw new RepositoryTreeError(422, 'Repository tree output was malformed.');
    }

    return {
      kind: type === 'tree' ? 'directory' : type === 'commit' ? 'submodule' : 'file',
      path,
    };
  });

  entries.sort((a, b) => a.path.split('/').length - b.path.split('/').length);
  const roots: RepositoryTreeNode[] = [];
  const directories = new Map<string, Extract<RepositoryTreeNode, { kind: 'directory' }>>();

  for (const entry of entries) {
    const separator = entry.path.lastIndexOf('/');
    const parentPath = separator === -1 ? '' : entry.path.slice(0, separator);
    const name = separator === -1 ? entry.path : entry.path.slice(separator + 1);
    if (!name) throw new RepositoryTreeError(422, 'Repository tree output was malformed.');

    const node: RepositoryTreeNode = entry.kind === 'directory'
      ? { kind: 'directory', name, path: entry.path, children: [] }
      : { kind: entry.kind, name, path: entry.path };
    const siblings = parentPath ? directories.get(parentPath)?.children : roots;
    if (!siblings) throw new RepositoryTreeError(422, 'Repository tree output was missing a parent directory.');
    siblings.push(node);
    if (node.kind === 'directory') directories.set(node.path, node);
  }

  const sortChildren = (nodes: RepositoryTreeNode[]): void => {
    nodes.sort(compareNodes);
    for (const node of nodes) if (node.kind === 'directory') sortChildren(node.children);
  };
  sortChildren(roots);
  return roots;
}

async function git(gitDir: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await run('git', ['--git-dir', gitDir, ...args], {
      encoding: 'utf8',
      timeout: GIT_TIMEOUT_MS,
      maxBuffer: GIT_MAX_BUFFER,
    });
    return stdout;
  } catch (error) {
    if (error && typeof error === 'object' && Reflect.get(error, 'code') === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
      throw new RepositoryTreeError(413, 'Repository tree is too large to display.');
    }
    throw new RepositoryTreeError(422, 'Could not read the repository default-branch tree.');
  }
}

export async function readRepositoryTree(canonicalUrl: string): Promise<RepositoryTree> {
  const gitDir = repositoryMirrorPath(canonicalUrl);
  if (!existsSync(gitDir)) {
    throw new RepositoryTreeError(409, 'Repository tree is unavailable. Analyze the repository again.');
  }

  return readRepositoryTreeFromMirror(gitDir);
}

export async function readRepositoryTreeFromMirror(gitDir: string): Promise<RepositoryTree> {
  const [branch, commitHash, rawTree] = await Promise.all([
    git(gitDir, ['symbolic-ref', '--short', 'HEAD']),
    git(gitDir, ['rev-parse', 'HEAD']),
    git(gitDir, ['ls-tree', '-z', '-r', '-t', '--full-tree', 'HEAD']),
  ]);

  return {
    branch: branch.trim(),
    commitHash: commitHash.trim(),
    nodes: parseGitTree(rawTree),
  };
}

export function filePaths(nodes: RepositoryTreeNode[]): Set<string> {
  const paths = new Set<string>();
  const visit = (children: RepositoryTreeNode[]): void => {
    for (const node of children) {
      if (node.kind === 'directory') visit(node.children);
      if (node.kind === 'file') paths.add(node.path);
    }
  };
  visit(nodes);
  return paths;
}
