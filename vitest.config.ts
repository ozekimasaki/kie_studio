import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // `bun:sqlite` is unavailable under Node; map it to a better-sqlite3
      // shim so the server DB layer can be exercised in Vitest.
      'bun:sqlite': fileURLToPath(
        new URL('./src/test/bun-sqlite-shim.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
    clearMocks: true,
  },
})
