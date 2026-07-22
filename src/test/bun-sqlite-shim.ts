import BetterSqlite3 from 'better-sqlite3'

/**
 * Test-only shim that emulates the subset of the `bun:sqlite` API used by the
 * server (`server/db/*`) on top of `better-sqlite3`, so Vitest can run under
 * Node where `bun:sqlite` is unavailable. Wired via the `bun:sqlite` alias in
 * `vitest.config.ts`.
 *
 * Both drivers accept bare-key named parameters (`@name` in SQL bound with
 * `{ name }`), positional `?` params, `.exec()`, `.prepare().run/get/all`, and
 * `.transaction()`, so this thin subclass is behaviourally equivalent for our
 * usage. The `strict` option is accepted (and ignored) for parity with
 * `bun:sqlite`.
 */
export class Database extends BetterSqlite3 {
  constructor(filename: string, _options?: { strict?: boolean }) {
    super(filename)
  }

  /** `bun:sqlite` exposes `query()` as a cached `prepare()`. */
  query(sql: string) {
    return this.prepare(sql)
  }
}
