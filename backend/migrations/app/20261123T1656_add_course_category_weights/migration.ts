#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/0cb708c2bf15ed6a0a426db2f5241a9b60f73ae6615aad2a63a3a10ed1060927/contract';
import startContract from '../../snapshots/0cb708c2bf15ed6a0a426db2f5241a9b60f73ae6615aad2a63a3a10ed1060927/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/1f6045099ed65349ccb7f3165e98944ded25ceb55cc1b093d2f115032bcbf47a/contract';
import endContract from '../../snapshots/1f6045099ed65349ccb7f3165e98944ded25ceb55cc1b093d2f115032bcbf47a/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'courseCategoryWeight',
        columns: [
          col('category', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('courseID', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('percent', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['courseID', 'category'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'course',
        column: col('weightsUpdatedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
      this.createIndex({
        schema: 'public',
        table: 'courseCategoryWeight',
        index: 'courseCategoryWeight_courseID_idx_7300c0bc',
        columns: ['courseID'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'courseCategoryWeight',
        foreignKey: {
          name: 'courseCategoryWeight_courseID_fkey',
          columns: ['courseID'],
          references: { schema: 'public', table: 'course', columns: ['courseID'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
