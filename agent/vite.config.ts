import { fileURLToPath } from 'node:url';
import { flue } from '@flue/vite';
import { defineConfig, type Plugin } from 'vite';

const sqliteShim = fileURLToPath(new URL('./src/node-sqlite-shim.ts', import.meta.url)).replaceAll(
	'\\',
	'/',
);

// @flue/runtime/node statically imports 'node:sqlite', which Bun (the
// Electrobun desktop runtime) does not implement. node:-prefixed builtins are
// externalized before alias/resolveId hooks run, so rewrite the import inside
// the bundled runtime module to point at a dual-runtime shim instead. One
// dist then runs on both Node (dev sidecar) and Bun (desktop embedding).
function nodeSqliteRewrite(): Plugin {
	const needle = 'from "node:sqlite"';
	return {
		name: 'kie-agent-node-sqlite-rewrite',
		enforce: 'pre',
		transform: {
			filter: { id: /@flue\/runtime\/dist\/node\/index\.mjs$/ },
			handler(code) {
				if (!code.includes(needle)) return null;
				return code.replaceAll(needle, `from ${JSON.stringify(sqliteShim)}`);
			},
		},
	};
}

// The Flue runtime is bundled (noExternal) so the rewrite reaches it and the
// desktop package needs no node_modules staging.
export default defineConfig({
	plugins: [nodeSqliteRewrite(), flue()],
	server: {
		// The studio web frontend owns 5173; the agent dev server uses 8789 and
		// is reached through the frontend's /agents proxy.
		port: 8789,
	},
	ssr: {
		noExternal: [/^@flue\//, /^@earendil-works\//, 'hono', 'valibot'],
		external: ['bun:sqlite'],
	},
});