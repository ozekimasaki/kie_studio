// Dual-runtime SQLite driver shim for the Flue Node target.
//
// `@flue/runtime/node` does `import { DatabaseSync } from 'node:sqlite'`,
// but Bun (the Electrobun desktop runtime) does not implement node:sqlite.
// The agent server build aliases 'node:sqlite' to this module so the same
// dist artifact runs on Node (dev sidecar) and Bun (desktop embedding).
//
// bun:sqlite's Database exposes the same prepare/run/all/exec/close surface
// that Flue's sqlite adapter uses, so it is a drop-in stand-in here.
// The specifiers are intentionally non-literal so Vite neither resolves nor
// aliases these dynamic imports — the runtime resolver picks the driver.

interface SqliteStatement {
	all(...bindings: unknown[]): unknown[];
	run(...bindings: unknown[]): unknown;
}

export interface SqliteDatabase {
	prepare(query: string): SqliteStatement;
	exec(query: string): unknown;
	close(): void;
}

type SqliteDatabaseConstructor = new (path: string) => SqliteDatabase;

const nodeSpecifier = `node:${'sqlite'}`;
const bunSpecifier = `bun:${'sqlite'}`;

const mod = (await import(nodeSpecifier).catch(() => import(bunSpecifier))) as {
	DatabaseSync?: SqliteDatabaseConstructor;
	Database?: SqliteDatabaseConstructor;
};

const DatabaseSyncImpl = mod.DatabaseSync ?? mod.Database;

if (!DatabaseSyncImpl) {
	throw new Error(
		'[agent] no SQLite driver available: neither node:sqlite nor bun:sqlite could be loaded',
	);
}

export const DatabaseSync = DatabaseSyncImpl;