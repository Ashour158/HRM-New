/**
 * A tiny in-memory stand-in for a transactional Postgres connection, used by
 * the transaction-atomicity tests (see
 * `apps/hr-api/src/domains/{payroll,compensation,hr-core}/repositories/*.transaction-atomicity.test.ts`).
 *
 * It exists to prove one specific property without a live database: that a
 * repository write which runs inside `runWithTransaction(tx, ...)` lands in
 * that transaction's staging area — not in some separately-committed store —
 * so that when the transaction's callback throws (as it does in production
 * whenever a later step, e.g. the audit-record insert, fails), the write is
 * rolled back with everything else.
 *
 * Semantics deliberately mirror Kysely's real `db.transaction().execute(cb)`
 * contract: writes made through the `tx` object passed into `cb` are only
 * merged into the shared "committed" store if `cb` resolves; if it throws,
 * the staged writes are discarded and the rejection propagates. Writes made
 * directly through `autocommitDb` (representing a repository's own separate
 * pooled connection) land in the committed store immediately, regardless of
 * what any concurrently-open transaction does — exactly like a second,
 * unrelated Postgres connection in autocommit mode.
 */

type Row = Record<string, unknown>;
type WhereFilter = [string, unknown];

function matches(row: Row, filters: WhereFilter[]): boolean {
  return filters.every(([col, val]) => row[col] === val);
}

function tableMap(store: Map<string, Map<string, Row>>, table: string): Map<string, Row> {
  if (!store.has(table)) store.set(table, new Map());
  return store.get(table)!;
}

function cloneStore(store: Map<string, Map<string, Row>>): Map<string, Map<string, Row>> {
  const clone = new Map<string, Map<string, Row>>();
  for (const [table, rows] of store) {
    clone.set(table, new Map(rows));
  }
  return clone;
}

/** Builds a Kysely-shaped query executor backed by the given in-memory store. */
function makeExecutor(store: Map<string, Map<string, Row>>) {
  function selectFrom(table: string) {
    const filters: WhereFilter[] = [];
    const builder = {
      selectAll: () => builder,
      select: () => builder,
      where: (col: string, _op: string, val: unknown) => {
        filters.push([col, val]);
        return builder;
      },
      orderBy: () => builder,
      limit: () => builder,
      offset: () => builder,
      executeTakeFirst: async () => [...tableMap(store, table).values()].find((row) => matches(row, filters)),
      execute: async () => [...tableMap(store, table).values()].filter((row) => matches(row, filters)),
    };
    return builder;
  }

  function insertInto(table: string) {
    let row: Row = {};
    const builder = {
      values: (r: Row) => {
        row = { ...r };
        return builder;
      },
      // Upsert-by-id semantics are enough for these tests: whether or not a
      // conflict handler is attached, writing the row keyed by `id` behaves
      // like "insert, or replace if present" — the atomicity property under
      // test (does the write land in `committed` or in the transaction's
      // staging) doesn't depend on the exact conflict-resolution strategy.
      onConflict: (fn: (oc: {
        doNothing: () => unknown;
        columns: (cols: string[]) => { doUpdateSet: (set: Row) => unknown; doNothing: () => unknown };
      }) => unknown) => {
        fn({
          doNothing: () => undefined,
          columns: () => ({ doUpdateSet: () => undefined, doNothing: () => undefined }),
        });
        return builder;
      },
      returningAll: () => builder,
      execute: async () => {
        tableMap(store, table).set(String(row.id), row);
      },
      executeTakeFirst: async () => {
        tableMap(store, table).set(String(row.id), row);
        return row;
      },
      executeTakeFirstOrThrow: async () => {
        tableMap(store, table).set(String(row.id), row);
        return row;
      },
    };
    return builder;
  }

  function updateTable(table: string) {
    let setValues: Row = {};
    const filters: WhereFilter[] = [];
    const builder = {
      set: (r: Row) => {
        setValues = r;
        return builder;
      },
      where: (col: string, _op: string, val: unknown) => {
        filters.push([col, val]);
        return builder;
      },
      returningAll: () => builder,
      executeTakeFirst: async () => {
        const map = tableMap(store, table);
        for (const [id, row] of map) {
          if (matches(row, filters)) {
            const updated = { ...row, ...setValues };
            map.set(id, updated);
            return updated;
          }
        }
        return undefined;
      },
      execute: async () => undefined,
    };
    return builder;
  }

  return { selectFrom, insertInto, updateTable };
}

export function createFakeTransactionalStore() {
  const committed = new Map<string, Map<string, Row>>();

  return {
    /** The ground-truth "committed" state of every table. */
    committed,
    /**
     * Represents a repository's own separate pooled connection: writes here
     * land in `committed` immediately, independent of any open transaction.
     */
    autocommitDb: makeExecutor(committed) as never,
    /** Mimics `Kysely#transaction()` — call `.execute(cb)` on the result. */
    transaction: () => ({
      execute: async <T>(cb: (tx: unknown) => Promise<T>): Promise<T> => {
        const staging = cloneStore(committed);
        const tx = makeExecutor(staging);
        const result = await cb(tx as never);
        // Only reached if `cb` resolved without throwing — i.e. "commit".
        committed.clear();
        for (const [table, rows] of staging) {
          committed.set(table, rows);
        }
        return result;
      },
    }),
  };
}
