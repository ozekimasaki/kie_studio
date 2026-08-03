import type { ElectrobunConfig } from 'electrobun/bun'

// Keep `app.version` in sync with package.json ("version").
export default {
  app: {
    name: 'KIE STUDIO',
    identifier: 'ai.kie.studio',
    version: '1.0.10'
  },
  build: {
    useAsar: true,
    bun: {
      entrypoint: 'src/bun/index.ts',
      external: [],
    },
    views: {},
    // Vite build output (base: '/') → packaged webview under views://mainview/.
    // agent/dist is the self-contained Flue embed (ssr.noExternal); no node_modules staging.
    copy: {
      'dist/index.html': 'views/mainview/index.html',
      'dist/assets/': 'views/mainview/assets/',
      'dist/favicon.svg': 'views/mainview/favicon.svg',
      'agent/dist/': 'agent-server/',
    },
    // Keep agent-server on disk so Bun can dynamic-import app.mjs at runtime.
    asarUnpack: ['agent-server/**'],
    watchIgnore: ['dist/**'],
    // Code signing / notarization are out of scope (unsigned distribution).
    mac: {
      codesign: false,
      notarize: false,
      bundleCEF: false,
      entitlements: {},
      // App icon (iconset folder → .icns via iconutil on macOS builder).
      icons: 'assets/icon.iconset',
    },
    linux: {
      bundleCEF: false,
      // App icon for desktop entries / window / taskbar (PNG, >=256px).
      icon: 'assets/icon.png',
    },
    win: {
      bundleCEF: false,
      // App icon for installer / shortcuts / taskbar (multi-size ICO).
      icon: 'assets/icon.ico',
    },
  },
  release: {
    // Static host for differential auto-updates; empty disables updates.
    baseUrl: process.env.RELEASE_BASE_URL ?? '',
  },
} satisfies ElectrobunConfig
