// Minimal ambient declarations for the `electrobun/bun` main-process API used
// by `src/bun/index.ts`. Electrobun is only installed in the Bun/desktop build
// environment, so we declare the surface we consume to keep `tsc` green under
// Node. Replace with the package's own types once it is installed locally.

declare module 'electrobun/bun' {
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

  const Electrobun: ElectrobunApi
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
}
