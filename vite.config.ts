import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import {
  AGENT_UNAVAILABLE_DEV_HINT,
  AGENT_UNAVAILABLE_MESSAGE,
  agentUnavailableBody,
} from './src/lib/agentUnavailable.ts'

const pkg = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('./package.json', import.meta.url)),
    'utf8',
  ),
) as { version: string }

export default defineConfig(() => ({
  // Electrobun's views:// protocol resolves root-absolute paths (/assets/...)
  // relative to the view directory (views/mainview/). Matches the official
  // electrobun-starter which uses the default base '/'.
  base: '/',
  plugins: [react(), tailwindcss()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
      '/media': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
      // Agent server (Flue sidecar, dev:agent). SSE streams pass through.
      '/agents': {
        target: 'http://127.0.0.1:8789',
        changeOrigin: true,
        timeout: 0,
        proxyTimeout: 0,
        configure(proxy) {
          proxy.on('error', (err, _req, res) => {
            const payload = JSON.stringify(
              agentUnavailableBody(
                err instanceof Error ? err.message : String(err),
                `${AGENT_UNAVAILABLE_MESSAGE} ${AGENT_UNAVAILABLE_DEV_HINT}`,
              ),
            )
            if (
              res &&
              'headersSent' in res &&
              !res.headersSent &&
              'writeHead' in res &&
              typeof res.writeHead === 'function'
            ) {
              res.writeHead(502, { 'Content-Type': 'application/json' })
              res.end(payload)
              return
            }
            if (res && 'end' in res && typeof res.end === 'function') {
              res.end()
            }
          })
        },
      },
    },
  },
}))
