import { describe, expect, it } from 'vitest';
import type { Transaction } from 'kysely';
import type { Database } from '../kysely/database.js';
import { getCurrentTransaction, runWithTransaction } from './transaction-context.js';

describe('transaction context', () => {
  it('keeps the current transaction available across async repository work only inside the transaction scope', async () => {
    const tx = { marker: 'command-transaction' } as unknown as Transaction<Database>;

    expect(getCurrentTransaction()).toBeUndefined();

    await runWithTransaction(tx, async () => {
      expect(getCurrentTransaction()).toBe(tx);
      await Promise.resolve();
      expect(getCurrentTransaction()).toBe(tx);
    });

    expect(getCurrentTransaction()).toBeUndefined();
  });
});
