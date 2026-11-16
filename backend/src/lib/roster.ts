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

  return text === '' ? null : text;
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
  if (username && !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(username)) {
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
