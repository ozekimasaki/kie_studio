import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const pkg = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('./package.json', import.meta.url)),
    'utf8',
  ),
) as { version: string }

export default defineConfig(({ command }) => ({
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
    },
  },
}))
