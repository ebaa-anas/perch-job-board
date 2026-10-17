import { vi } from "vitest";

/**
 * A stand-in for the Supabase query builder, for unit tests of Server Actions.
 *
 * Every chain method (`select`, `eq`, `insert`, `maybeSingle`, …) returns the
 * same builder; awaiting it resolves to whatever the test registered for that
 * table. Each chain is recorded, so a test can assert what was written — and,
 * for the demo guards, that nothing was.
 */

type QueryError = { message: string; code?: string };
export type QueryResult = { data?: unknown; error?: QueryError | null; count?: number | null };

export interface QueryLog {
  table: string;
  ops: { method: string; args: unknown[] }[];
}

const WRITES = new Set(["insert", "update", "upsert", "delete"]);

export function fakeQueries(
  results: Record<string, QueryResult | ((log: QueryLog) => QueryResult)> = {},
) {
  const calls: QueryLog[] = [];

  const from = vi.fn((table: string) => {
    const log: QueryLog = { table, ops: [] };
    calls.push(log);
    const builder: object = new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === "then") {
            const entry = results[table];
            const value = typeof entry === "function" ? entry(log) : entry;
            const settled = { data: null, error: null, ...value };
            return (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
              Promise.resolve(settled).then(resolve, reject);
          }
          return (...args: unknown[]) => {
            log.ops.push({ method: String(prop), args });
            return builder;
          };
        },
      },
    );
    return builder;
  });

  return {
    from,
    calls,
    /** Whether any insert/update/upsert/delete reached `table`. */
    wrote(table: string): boolean {
      return calls.some(
        (call) => call.table === table && call.ops.some((op) => WRITES.has(op.method)),
      );
    },
    touched(table: string): boolean {
      return calls.some((call) => call.table === table);
    },
  };
}
