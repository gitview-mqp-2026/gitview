#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/0cb708c2bf15ed6a0a426db2f5241a9b60f73ae6615aad2a63a3a10ed1060927/contract';
import endContract from '../../snapshots/0cb708c2bf15ed6a0a426db2f5241a9b60f73ae6615aad2a63a3a10ed1060927/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/f8d10ea49d961dafadd2599df44910ab7e8f24f9cafcbdd471d6e128f55e78fe/contract';
import startContract from '../../snapshots/f8d10ea49d961dafadd2599df44910ab7e8f24f9cafcbdd471d6e128f55e78fe/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropColumn({ schema: 'public', table: 'feedback', column: 'dateTime' }),
      this.createTable({
        schema: 'public',
        table: 'repositoryDirectoryLabel',
        columns: [
          col('category', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('path', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('teamID', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['teamID', 'path'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'repositoryFileLabel',
        columns: [
          col('category', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('path', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('teamID', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['teamID', 'path'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'repositoryDirectoryLabel',
        index: 'repositoryDirectoryLabel_teamID_idx_fe196944',
        columns: ['teamID'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'repositoryFileLabel',
        index: 'repositoryFileLabel_teamID_idx_fe196944',
        columns: ['teamID'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'repositoryDirectoryLabel',
        foreignKey: {
          name: 'repositoryDirectoryLabel_teamID_fkey',
          columns: ['teamID'],
          references: { schema: 'public', table: 'repository', columns: ['teamID'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'repositoryFileLabel',
        foreignKey: {
          name: 'repositoryFileLabel_teamID_fkey',
          columns: ['teamID'],
          references: { schema: 'public', table: 'repository', columns: ['teamID'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
