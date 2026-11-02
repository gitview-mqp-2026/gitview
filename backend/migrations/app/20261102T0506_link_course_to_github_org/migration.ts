#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/59f7b52cef9c750c2fe209cc4f20f6ad51789575fecc0568e4701a5d3e3ded8c/contract';
import startContract from '../../snapshots/59f7b52cef9c750c2fe209cc4f20f6ad51789575fecc0568e4701a5d3e3ded8c/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/c37bd872c0d32ea30b2f0133a112e2636e08c1a161c3285146a88550d797f55e/contract';
import endContract from '../../snapshots/c37bd872c0d32ea30b2f0133a112e2636e08c1a161c3285146a88550d797f55e/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'course',
        column: col('githubOrg', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'course',
        column: col('installationId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'repository',
        column: col('courseID', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'repository',
        column: col('githubRepoId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'course',
        constraint: 'course_githubOrg_key',
        columns: ['githubOrg'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'repository',
        constraint: 'repository_githubRepoId_key',
        columns: ['githubRepoId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'repository',
        index: 'repository_courseID_idx_7300c0bc',
        columns: ['courseID'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'repository',
        foreignKey: {
          name: 'repository_courseID_fkey',
          columns: ['courseID'],
          references: { schema: 'public', table: 'course', columns: ['courseID'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
