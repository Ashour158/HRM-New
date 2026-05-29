import { AsyncLocalStorage } from 'node:async_hooks';
import type { Transaction } from 'kysely';
import type { Database } from '../kysely/database.js';

const transactionContext = new AsyncLocalStorage<Transaction<Database>>();

export function runWithTransaction<T>(
  trx: Transaction<Database>,
  callback: () => Promise<T>,
): Promise<T> {
  return transactionContext.run(trx, callback);
}

export function getCurrentTransaction(): Transaction<Database> | undefined {
  return transactionContext.getStore();
}
