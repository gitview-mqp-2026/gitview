#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/1e007f9d123be96a73b31ad198af174b0a9c99feab3fbb943cee488972ad5730/contract';
import startContract from '../../snapshots/1e007f9d123be96a73b31ad198af174b0a9c99feab3fbb943cee488972ad5730/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/59f7b52cef9c750c2fe209cc4f20f6ad51789575fecc0568e4701a5d3e3ded8c/contract';
import endContract from '../../snapshots/59f7b52cef9c750c2fe209cc4f20f6ad51789575fecc0568e4701a5d3e3ded8c/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  col,
  placeholder,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'course',
        columns: [
          col('courseID', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('courseName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('courseTerm', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('instructorID', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['courseID'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'feedback',
        column: col('dateTime', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
      this.dataTransform(endContract, 'backfill-feedback-dateTime', {
        check: () => placeholder('backfill-feedback-dateTime:check'),
        run: () => placeholder('backfill-feedback-dateTime:run'),
      }),
      this.setNotNull({ schema: 'public', table: 'feedback', column: 'dateTime' }),
      this.createIndex({
        schema: 'public',
        table: 'course',
        index: 'course_instructorID_idx_dc3c3202',
        columns: ['instructorID'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'course',
        foreignKey: {
          name: 'course_instructorID_fkey',
          columns: ['instructorID'],
          references: { schema: 'public', table: 'instructor', columns: ['userID'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
