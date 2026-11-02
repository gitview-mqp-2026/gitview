#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/1e007f9d123be96a73b31ad198af174b0a9c99feab3fbb943cee488972ad5730/contract';
import endContract from '../../snapshots/1e007f9d123be96a73b31ad198af174b0a9c99feab3fbb943cee488972ad5730/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'alert',
        columns: [
          col('alertID', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('alertStatus', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('alertType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('commitHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('studentID', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['alertID'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'commit',
        columns: [
          col('author', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('commitBody', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('commitHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('commitSubject', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('committer', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('dateTime', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('isMerge', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('refs', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('studentID', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['commitHash'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'commitTag',
        columns: [
          col('commitHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('tagID', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['commitHash', 'tagID'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'feedback',
        columns: [
          col('authorID', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('comment', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('commitHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('feedbackID', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['feedbackID'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'fileChange',
        columns: [
          col('additions', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('commitHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('deletions', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('fileID', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('filePath', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['fileID'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'instructor',
        columns: [col('userID', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } })],
        constraints: [primaryKey(['userID'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'repository',
        columns: [
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('teamID', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('url', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['teamID'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'student',
        columns: [
          col('teamID', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('userID', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['userID'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'tag',
        columns: [
          col('categoryName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('tagID', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['tagID'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'user',
        columns: [
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('userID', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('username', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['userID'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'user',
        constraint: 'user_email_key',
        columns: ['email'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'alert',
        index: 'alert_commitHash_idx_a57efd78',
        columns: ['commitHash'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'alert',
        index: 'alert_studentID_idx_af8ad155',
        columns: ['studentID'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'commit',
        index: 'commit_studentID_idx_af8ad155',
        columns: ['studentID'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'commitTag',
        index: 'commitTag_commitHash_idx_a57efd78',
        columns: ['commitHash'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'commitTag',
        index: 'commitTag_tagID_idx_061c18c6',
        columns: ['tagID'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'feedback',
        index: 'feedback_authorID_idx_65a4ffa8',
        columns: ['authorID'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'feedback',
        index: 'feedback_commitHash_idx_a57efd78',
        columns: ['commitHash'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'fileChange',
        index: 'fileChange_commitHash_idx_a57efd78',
        columns: ['commitHash'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'student',
        index: 'student_teamID_idx_fe196944',
        columns: ['teamID'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'alert',
        foreignKey: {
          name: 'alert_commitHash_fkey',
          columns: ['commitHash'],
          references: { schema: 'public', table: 'commit', columns: ['commitHash'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'alert',
        foreignKey: {
          name: 'alert_studentID_fkey',
          columns: ['studentID'],
          references: { schema: 'public', table: 'student', columns: ['userID'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'commit',
        foreignKey: {
          name: 'commit_studentID_fkey',
          columns: ['studentID'],
          references: { schema: 'public', table: 'student', columns: ['userID'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'commitTag',
        foreignKey: {
          name: 'commitTag_commitHash_fkey',
          columns: ['commitHash'],
          references: { schema: 'public', table: 'commit', columns: ['commitHash'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'commitTag',
        foreignKey: {
          name: 'commitTag_tagID_fkey',
          columns: ['tagID'],
          references: { schema: 'public', table: 'tag', columns: ['tagID'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'feedback',
        foreignKey: {
          name: 'feedback_authorID_fkey',
          columns: ['authorID'],
          references: { schema: 'public', table: 'user', columns: ['userID'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'feedback',
        foreignKey: {
          name: 'feedback_commitHash_fkey',
          columns: ['commitHash'],
          references: { schema: 'public', table: 'commit', columns: ['commitHash'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'fileChange',
        foreignKey: {
          name: 'fileChange_commitHash_fkey',
          columns: ['commitHash'],
          references: { schema: 'public', table: 'commit', columns: ['commitHash'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'instructor',
        foreignKey: {
          name: 'instructor_userID_fkey',
          columns: ['userID'],
          references: { schema: 'public', table: 'user', columns: ['userID'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'student',
        foreignKey: {
          name: 'student_userID_fkey',
          columns: ['userID'],
          references: { schema: 'public', table: 'user', columns: ['userID'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'student',
        foreignKey: {
          name: 'student_teamID_fkey',
          columns: ['teamID'],
          references: { schema: 'public', table: 'repository', columns: ['teamID'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
