import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { db } from '../prisma/db.js';
import { CourseError } from './courses.js';

export interface StudentEdit {
  name?: unknown;
  username?: unknown;
  email?: unknown;
}

function optionalText(value: unknown, label: string, max: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new CourseError(400, `${label} must be text.`);
  }
  const text = value.trim();
  if (text.length > max) {
    throw new CourseError(400, `${label} must be at most ${max} characters.`);
  }

  return text === '' ? null : text;
}

const GITHUB_USERNAME = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

// groups items into a Map of key -> list of values
function groupBy<T, K, V>(items: T[], key: (item: T) => K, value: (item: T) => V): Map<K, V[]> {
  const groups = new Map<K, V[]>();
  for (const item of items) {
    const k = key(item);
    groups.set(k, [...(groups.get(k) ?? []), value(item)]);
  }
  return groups;
}

// the student must belong to a repository of this course
async function studentInCourse(courseID: number, userID: number) {
  if (!Number.isInteger(userID)) {
    throw new CourseError(400, 'Invalid student.');
  }
  const student = await db.orm.public.Student.where({ userID }).first();
  const repo = student ? await db.orm.public.Repository.where({ teamID: student.teamID }).first() : null;
  if (!student || !repo || repo.courseID !== courseID) {
    throw new CourseError(404, 'Student not found in this course.');
  }
  return student;
}

export async function editStudent(courseID: number, userID: number, edit: StudentEdit) {
  await studentInCourse(courseID, userID);

  const name = optionalText(edit.name, 'Name', 200);
  const username = optionalText(edit.username, 'GitHub username', 100);
  const email = optionalText(edit.email, 'Email', 320);

  if (email === null) {
    throw new CourseError(400, 'Email is required.');
  }
  if (username && !GITHUB_USERNAME.test(username)) {
    throw new CourseError(400, 'That is not a valid GitHub username.');
  }

  if (email !== undefined) {
    const taken = await db.orm.public.User.where({ email }).first();
    if (taken && taken.userID !== userID) {
      throw new CourseError(409, 'Another user already has that email.');
    }
  }

  const updates: { name?: string | null; username?: string | null; email?: string } = {};
  if (name !== undefined) updates.name = name;
  if (username !== undefined) updates.username = username;
  if (email !== undefined) updates.email = email;
  if (Object.keys(updates).length > 0) {
    await db.orm.public.User.where({ userID }).update(updates);
  }
}

// removes a student from the course, along with their commits, alerts, feedback and aliases
export async function deleteStudent(courseID: number, userID: number) {
  await studentInCourse(courseID, userID);

  await db.transaction(async (tx) => {
    await tx.orm.public.Student.where({ userID }).delete();
    await tx.orm.public.User.where({ userID }).delete();
  });
}

// merges the `mergeID` student into the `keepID` student, and removes the merged student
// their commits, alerts and feedback move over, blank fields on the kept student are filled from the merged one
export async function mergeStudents(courseID: number, keepID: number, mergeID: number) {
  if (keepID === mergeID) {
    throw new CourseError(400, 'Pick two different students to merge.');
  }
  // make sure both students are in the course
  await studentInCourse(courseID, keepID);
  await studentInCourse(courseID, mergeID);

  const [keep, merged] = await Promise.all([
    db.orm.public.User.where({ userID: keepID }).first(),
    db.orm.public.User.where({ userID: mergeID }).first(),
  ]);
  if (!keep || !merged) {
    throw new CourseError(404, 'Student not found.');
  }

  // fill missing fields with values from the merged student
  const fill: { name?: string; username?: string } = {};
  if (!keep.name && merged.name) fill.name = merged.name;
  if (!keep.username && merged.username) fill.username = merged.username;

  // commits from merged student identities/aliases go to the kept student
  const mergedTeamID = (await db.orm.public.Student.where({ userID: mergeID }).first())!.teamID;
  const identities = [`email:${merged.email.toLowerCase()}`];
  if (merged.username) {
    identities.push(`github:${merged.username.toLowerCase()}`);
  }

  await db.transaction(async (tx) => {
    // aliases the merged student already had go to the kept student
    await tx.orm.public.StudentAlias.where({ userID: mergeID }).update({ userID: keepID });
    for (const identity of identities) {
      const existing = await tx.orm.public.StudentAlias.where({ teamID: mergedTeamID, identity }).first();
      if (existing) {
        await tx.orm.public.StudentAlias.where({ teamID: mergedTeamID, identity }).update({ userID: keepID });
      } else {
        await tx.orm.public.StudentAlias.create({ teamID: mergedTeamID, identity, userID: keepID });
      }
    }
    await tx.orm.public.Commit.where({ studentID: mergeID }).update({ studentID: keepID });
    await tx.orm.public.Alert.where({ studentID: mergeID }).update({ studentID: keepID });
    await tx.orm.public.Feedback.where({ authorID: mergeID }).update({ authorID: keepID });
    if (Object.keys(fill).length > 0) {
      await tx.orm.public.User.where({ userID: keepID }).update(fill);
    }
    await tx.orm.public.Student.where({ userID: mergeID }).delete();
    await tx.orm.public.User.where({ userID: mergeID }).delete();
  });
}

// CSV export/import
const CSV_COLUMNS = ['userID', 'teamID', 'team', 'name', 'username', 'email', 'aliases'] as const;
const ALIAS_PATTERN = /^(email|github):\S+$/; // aliases is a list of identities separated by semicolons ex. "email:name@email.com;github:username"

// one row per student (ids used to match rows for import)
export async function exportRosterCsv(courseID: number): Promise<string> {
  const repositories = await db.orm.public.Repository.where({ courseID }).all();
  const teams = new Map(repositories.map((repo) => [repo.teamID, repo.name]));
  const [students, users] = await Promise.all([db.orm.public.Student.all(), db.orm.public.User.all()]);
  const usersByID = new Map(users.map((user) => [user.userID, user]));
  const aliasesByUser = groupBy(await db.orm.public.StudentAlias.all(), (a) => a.userID, (a) => a.identity);

  // build a list of rows for the CSV, one per student in the course
  const rows = students
    .filter((student) => teams.has(student.teamID))
    .map((student) => {
      const user = usersByID.get(student.userID);
      return {
        aliases: (aliasesByUser.get(student.userID) ?? []).sort().join(';'),
        userID: student.userID,
        teamID: student.teamID,
        team: teams.get(student.teamID)!,
        name: user?.name ?? '',
        username: user?.username ?? '',
        email: user?.email ?? '',
      };
    })
    .sort((a, b) => a.team.localeCompare(b.team) || a.name.localeCompare(b.name));

  return stringify(rows, { header: true, columns: [...CSV_COLUMNS], bom: true, record_delimiter: 'windows' });
}

interface ImportRow {
  line: number;
  aliases: string[];
  userID: number | null;
  teamID: number;
  name: string | null;
  username: string | null;
  email: string;
}

export interface ImportResult {
  updated: number;
  added: number;
  unchanged: number;
}

// applies an imported roster CSV by updating existing students and adding new ones, does not remove students that are not in the file
export async function importRosterCsv(courseID: number, csv: unknown): Promise<ImportResult> {
  if (typeof csv !== 'string' || csv.trim() === '') {
    throw new CourseError(400, 'The CSV file is empty.');
  }

  // parse the CSV into a table of rows and columns
  let table: string[][];
  try {
    table = parse(csv, { bom: true, skip_empty_lines: true, relax_column_count: true });
  } catch {
    throw new CourseError(400, 'The file is not a valid CSV.');
  }

  // remove empty rows and trim whitespace from the header row
  table = table.filter((r) => r.some((c) => c.trim() !== ''));
  const header = (table.shift() ?? []).map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name.toLowerCase());
  const [iUser, iTeamID, iTeam, iName, iUsername, iEmail, iAliases] = CSV_COLUMNS.map(col);
  if (iEmail < 0 || (iTeamID < 0 && iTeam < 0)) {
    throw new CourseError(400, 'The CSV needs a header row with at least the columns teamID (or team) and email.');
  }
  const cell = (r: string[], i: number) => (i < 0 ? '' : (r[i] ?? '').trim());

  // load all the data we need to validate the import
  const repositories = await db.orm.public.Repository.where({ courseID }).all();
  const teamIDs = new Set(repositories.map((repo) => repo.teamID));
  const teamsByName = groupBy(repositories, (repo) => repo.name.toLowerCase(), (repo) => repo.teamID);

  const [students, users] = await Promise.all([db.orm.public.Student.all(), db.orm.public.User.all()]);
  const courseStudents = new Map(students.filter((s) => teamIDs.has(s.teamID)).map((s) => [s.userID, s]));
  const usersByID = new Map(users.map((u) => [u.userID, u]));
  const usersByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));
  const allAliases = await db.orm.public.StudentAlias.all();
  const aliasesByUser = groupBy(allAliases, (a) => a.userID, (a) => a.identity);

  const rows: ImportRow[] = [];
  const seenUsers = new Set<number>();
  const seenEmails = new Set<string>();

  // validate each row and build a list of rows to import
  table.forEach((r, index) => {
    const line = index + 2; // +2 because the header row is line 1
    const fail = (message: string): never => {
      throw new CourseError(400, `Row ${line}: ${message}`);
    };

    const rawID = cell(r, iUser);
    const userID = rawID === '' ? null : Number(rawID);
    if (userID !== null && !courseStudents.has(userID)) {
      fail(`userID ${rawID} is not a student in this course. Leave userID blank to add a new student.`);
    }
    if (userID !== null) {
      if (seenUsers.has(userID)) fail(`userID ${userID} appears more than once.`);
      seenUsers.add(userID);
    }

    // teamID can be specified by teamID or team name, or inferred from the existing student if userID is given
    let teamID: number | undefined;
    const rawTeamID = cell(r, iTeamID);
    const rawTeam = cell(r, iTeam);
    if (rawTeamID !== '') {
      teamID = Number(rawTeamID);
      if (!teamIDs.has(teamID)) fail(`teamID ${rawTeamID} is not a team in this course.`);
    } else if (rawTeam !== '') {
      const matches = teamsByName.get(rawTeam.toLowerCase()) ?? [];
      if (matches.length === 0) fail(`team "${rawTeam}" was not found in this course.`);
      if (matches.length > 1) fail(`team "${rawTeam}" matches more than one team, use its teamID.`);
      teamID = matches[0];
    } else if (userID !== null) {
      teamID = courseStudents.get(userID)!.teamID;
    } else {
      fail('a new student needs a team or teamID.');
    }

    // validate email, check for duplicates, and check for conflicts with existing users
    const email = cell(r, iEmail);
    if (email === '') fail('email is required.');
    if (!/^[^\s@]+@[^\s@]+$/.test(email)) fail(`"${email}" is not a valid email.`);
    const emailKey = email.toLowerCase();
    if (seenEmails.has(emailKey)) fail(`email ${email} appears more than once.`);
    seenEmails.add(emailKey);
    const owner = usersByEmail.get(emailKey);
    if (owner && owner.userID !== userID) fail(`another user already has the email ${email}.`);

    // validate GitHub username if present
    const username = cell(r, iUsername);
    if (username !== '' && !GITHUB_USERNAME.test(username)) {
      fail(`"${username}" is not a valid GitHub username.`);
    }

    // validate aliases if present, or use the existing ones for this student
    let aliases: string[] = [];
    if (iAliases >= 0) {
      aliases = [...new Set(cell(r, iAliases).split(/[;\n]/).map((a) => a.trim().toLowerCase()).filter(Boolean))];
      for (const alias of aliases) {
        if (!ALIAS_PATTERN.test(alias)) fail(`alias "${alias}" must look like email:name@example.com or github:username.`);
      }
    } else if (userID !== null) {
      aliases = aliasesByUser.get(userID) ?? [];
    }

    rows.push({
      line,
      aliases,
      userID,
      teamID: teamID!,
      name: cell(r, iName) || null,
      username: username || null,
      email,
    });
  });

  // check that no alias is being assigned to more than one student
  const inFile = new Set(rows.flatMap((row) => (row.userID === null ? [] : [row.userID])));
  const owners = new Map(
    allAliases.filter((a) => !inFile.has(a.userID)).map((a) => [`${a.teamID}|${a.identity}`, String(a.userID)]),
  );

  rows.forEach((row, index) => {
    const owner = row.userID === null ? `new${index}` : String(row.userID);
    for (const alias of row.aliases) {
      const key = `${row.teamID}|${alias}`;
      if (owners.has(key) && owners.get(key) !== owner) {
        throw new CourseError(400, `Row ${row.line}: alias ${alias} already belongs to another student on that team.`);
      }
      owners.set(key, owner);
    }
  });

  const result: ImportResult = { updated: 0, added: 0, unchanged: 0 };

  // apply the changes
  await db.transaction(async (tx) => {
    for (const row of rows) {
      if (row.userID === null) {
        const user = await tx.orm.public.User.create({ email: row.email, name: row.name, username: row.username });
        await tx.orm.public.Student.create({ userID: user.userID, teamID: row.teamID });
        for (const identity of row.aliases) {
          await tx.orm.public.StudentAlias.create({ teamID: row.teamID, identity, userID: user.userID });
        }
        result.added++;
        continue;
      }

      const user = usersByID.get(row.userID)!;
      const student = courseStudents.get(row.userID)!;
      const userChanged =
        (user.name ?? null) !== row.name || (user.username ?? null) !== row.username || user.email !== row.email;
      const teamChanged = student.teamID !== row.teamID;

      if (userChanged) {
        await tx.orm.public.User.where({ userID: row.userID }).update({
          name: row.name,
          username: row.username,
          email: row.email,
        });
      }
      if (teamChanged) {
        await tx.orm.public.Student.where({ userID: row.userID }).update({ teamID: row.teamID });
      }

      // rewrite aliases when they changed or the student moved teams (aliases are per team)
      const before = [...(aliasesByUser.get(row.userID) ?? [])].sort().join(';');
      const aliasesChanged = before !== [...row.aliases].sort().join(';');
      if (aliasesChanged || teamChanged) {
        await tx.orm.public.StudentAlias.where({ userID: row.userID }).delete();
        for (const identity of row.aliases) {
          await tx.orm.public.StudentAlias.create({ teamID: row.teamID, identity, userID: row.userID });
        }
      }

      if (userChanged || teamChanged || aliasesChanged) result.updated++;
      else result.unchanged++;
    }
  });

  return result;
}
