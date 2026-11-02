#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/c37bd872c0d32ea30b2f0133a112e2636e08c1a161c3285146a88550d797f55e/contract';
import startContract from '../../snapshots/c37bd872c0d32ea30b2f0133a112e2636e08c1a161c3285146a88550d797f55e/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/f8d10ea49d961dafadd2599df44910ab7e8f24f9cafcbdd471d6e128f55e78fe/contract';
import endContract from '../../snapshots/f8d10ea49d961dafadd2599df44910ab7e8f24f9cafcbdd471d6e128f55e78fe/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'course',
        column: col('repoPattern', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
