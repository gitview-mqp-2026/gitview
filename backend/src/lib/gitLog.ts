import { execFileSync } from 'node:child_process';

// Reading a repository's history. Kept free of database code so the parsing, and what git actually reports, can
// be tested on real throwaway repositories.

export interface ParsedFileChange {
  filePath: string;
  additions: number;
  deletions: number;
}

export interface ParsedCommit {
  commitHash: string;
  parentHashes: string[];
  author: string;
  authorEmail: string;
  committer: string;
  committedAtMs: number;
  refs: string;
  subject: string;
  body: string;
  fileChanges: ParsedFileChange[];
}

const COMMIT_MARK = '--GITVIEW-COMMIT--';
const BODY_START = '--GITVIEW-BODY--';
const BODY_END = '--GITVIEW-BODY-END--';

// Where a renamed or moved file ends up. `git log --numstat` writes a rename as `old => new`, or as
// `prefix/{old => new}/suffix` when the two paths share a prefix or suffix (either side of the braces can be
// empty, as in `app/{auth => }/templates/base.html`). A label can only match the real, current path.
export function renamedPath(path: string): string {
  const braced = path.match(/^(.*)\{(.*) => (.*)\}(.*)$/);
  if (braced) {
    const [, prefix, , renamedTo, suffix] = braced;
    // An empty side leaves a doubled or leading slash behind: app/{auth => }/x is app//x.
    return `${prefix}${renamedTo}${suffix}`.replace(/\/{2,}/g, '/').replace(/^\//, '');
  }
  const arrow = path.lastIndexOf(' => ');
  return arrow === -1 ? path : path.slice(arrow + ' => '.length);
}

// Whitespace-only edits (-w) are not work, and renames (-M) are requested explicitly so the result does not
// depend on the user's `diff.renames` setting.
export function gitLogArgs(maxCommits?: number): string[] {
  return [
    'log',
    ...(maxCommits ? [`--max-count=${maxCommits}`] : []),
    `--pretty=format:${COMMIT_MARK}%n%H%n%P%n%an%n%ae%n%at%n%cn%n%D%n%s%n${BODY_START}%n%b%n${BODY_END}`,
    '--numstat',
    '-w',
    '-M',
  ];
}

export function parseGitLogOutput(raw: string): ParsedCommit[] {
  return raw
    .split(`${COMMIT_MARK}\n`)
    .filter(Boolean)
    .flatMap((block): ParsedCommit[] => {
      // Fixed-position header lines, then a marker-delimited body (it can span lines), then --numstat rows.
      const lines = block.split('\n');
      const commitHash = lines[0]?.trim() ?? '';
      if (commitHash.length !== 40 || lines[8]?.trim() !== BODY_START) return [];

      const bodyEnd = lines.indexOf(BODY_END, 9);
      if (bodyEnd === -1) return [];

      const fileChanges: ParsedFileChange[] = [];
      for (let i = bodyEnd + 1; i < lines.length; i++) {
        const match = lines[i].trim().match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
        if (match) {
          fileChanges.push({
            filePath: renamedPath(match[3]),
            additions: match[1] === '-' ? 0 : parseInt(match[1], 10),
            deletions: match[2] === '-' ? 0 : parseInt(match[2], 10),
          });
        }
      }

      return [
        {
          commitHash,
          parentHashes: (lines[1] ?? '').trim().split(/\s+/).filter(Boolean),
          author: lines[2].trim(),
          authorEmail: lines[3].trim().toLowerCase(),
          committedAtMs: parseInt(lines[4].trim(), 10) * 1000,
          committer: lines[5].trim(),
          refs: lines[6].trim(),
          subject: lines[7].trim(),
          body: lines.slice(9, bodyEnd).join('\n').trim(),
          fileChanges,
        },
      ];
    });
}

export function readGitLog(cwd: string, maxCommits?: number): ParsedCommit[] {
  const raw = execFileSync('git', gitLogArgs(maxCommits), { cwd, encoding: 'utf-8', maxBuffer: 200 * 1024 * 1024 });
  return parseGitLogOutput(raw);
}
