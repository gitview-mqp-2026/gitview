#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/35cd349abfa99026ba67308d69e77d7f0ffe4f41f728f049c45784bee73427db/contract';
import endContract from '../../snapshots/35cd349abfa99026ba67308d69e77d7f0ffe4f41f728f049c45784bee73427db/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/5269b730e13b4ace0fc52634c1be40b250dc1f9fb6056c4795bea1be8afa3d29/contract';
import startContract from '../../snapshots/5269b730e13b4ace0fc52634c1be40b250dc1f9fb6056c4795bea1be8afa3d29/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
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
        table: 'repositoryFileLabel',
        index: 'repositoryFileLabel_teamID_idx_fe196944',
        columns: ['teamID'],
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
