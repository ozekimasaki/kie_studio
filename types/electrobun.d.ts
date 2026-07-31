// Minimal module declarations for the `electrobun/bun` main-process API used by
// `src/bun/index.ts` and `electrobun.config.ts`.
//
// The published `electrobun` package ships raw `.ts` sources (its `exports`
// map points at `./dist/api/bun/index.ts`, with no `.d.ts`). Under `nodenext`
// resolution those sources are pulled into the program and type-checked, which
// fails (missing import extensions, an untyped `three` dependency, …) even
// though `skipLibCheck` is on — `skipLibCheck` only skips `.d.ts` files.
//
// `tsconfig.node.json` maps `electrobun/bun` to this file via `paths`, so we
// type-check `src/bun` against this hand-written surface instead of the
// dependency's shipped sources. Keep this in sync with the API we consume.

export interface BrowserWindowFrame {
  width?: number
  height?: number
  x?: number
  y?: number
}

export interface BrowserWindowOptions {
  title?: string
  url?: string
  frame?: BrowserWindowFrame
}

export class BrowserWindow {
  constructor(options?: BrowserWindowOptions)
}

export const Utils: {
  paths: {
    userData: string
    [key: string]: string
  }
}

export interface LocalUpdateInfo {
  version?: string
  hash?: string
  channel?: string
  baseUrl?: string
  updateAvailable?: boolean
  updateReady?: boolean
  [key: string]: unknown
}

export interface UpdaterApi {
  getLocal(): Promise<LocalUpdateInfo>
  checkForUpdate(): Promise<LocalUpdateInfo>
  downloadUpdate(): Promise<void>
  applyUpdate(): Promise<void>
  [key: string]: unknown
}

export interface ElectrobunApi {
  Updater: UpdaterApi
  [key: string]: unknown
}

declare const Electrobun: ElectrobunApi
export default Electrobun

// Build/distribution config consumed by the Electrobun CLI
// (electrobun.config.ts). Modeled loosely so `satisfies` stays permissive.
export interface ElectrobunConfig {
  app: {
    name: string
    identifier: string
    version: string
    [key: string]: unknown
  }
  build?: {
    useAsar?: boolean
    bun?: { entrypoint: string; external?: string[]; [key: string]: unknown }
    views?: Record<string, unknown>
    copy?: Record<string, string>
    watchIgnore?: string[]
    mac?: Record<string, unknown>
    win?: Record<string, unknown>
    linux?: Record<string, unknown>
    [key: string]: unknown
  }
  release?: { baseUrl?: string; [key: string]: unknown }
  [key: string]: unknown
}
