import { app } from 'electron'
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { AppPaths, Settings } from '../shared/types'

export const APP_NAME = 'DMCL'
export const APP_VERSION = app.getVersion()

export function appDataDir(): string {
  return app.getPath('userData')
}

export function configFile(): string {
  return join(appDataDir(), 'config.json')
}

export function cacheDir(): string {
  return join(appDataDir(), 'cache')
}

export function logsDir(): string {
  return join(appDataDir(), 'logs')
}

/** Directory that contains DMCL.exe. In development the project root is used instead. */
export function installDir(): string {
  if (app.isPackaged) return dirname(process.execPath)
  return app.getAppPath()
}

/**
 * Portable game data lives next to the client: <install dir>/minecraft.
 * If the launcher is running from a temporary self-extraction directory, fall back
 * to %APPDATA% to avoid writing hundreds of megabytes into a folder that disappears.
 */
export function defaultGameRoot(): string {
  const exeDir = installDir()
  if (app.isPackaged && /[\\/]Temp[\\/]|7z[^\\/]*[\\/]/i.test(exeDir)) {
    return join(appDataDir(), 'minecraft')
  }
  return join(exeDir, 'minecraft')
}

export function legacyGameRoot(): string {
  return join(appDataDir(), 'minecraft')
}

export function legacyInstancesDir(): string {
  return join(appDataDir(), 'instances')
}

export function gameInstancesDir(gameRoot: string): string {
  return join(gameRoot, 'instances')
}

export function resolvePaths(settings: Settings): AppPaths {
  const gameRoot = settings.gameRoot || defaultGameRoot()
  return {
    userData: appDataDir(),
    gameRoot,
    instancesDir: gameInstancesDir(gameRoot),
    cacheDir: cacheDir(),
    logsDir: logsDir(),
    versionsDir: join(gameRoot, 'versions'),
    librariesDir: join(gameRoot, 'libraries'),
    assetsDir: join(gameRoot, 'assets'),
    runtimeDir: join(gameRoot, 'runtime')
  }
}

export async function ensureBaseDirs(settings: Settings): Promise<void> {
  const paths = resolvePaths(settings)
  await Promise.all([
    mkdir(paths.userData, { recursive: true }),
    mkdir(paths.gameRoot, { recursive: true }),
    mkdir(paths.instancesDir, { recursive: true }),
    mkdir(paths.cacheDir, { recursive: true }),
    mkdir(paths.logsDir, { recursive: true }),
    mkdir(paths.versionsDir, { recursive: true }),
    mkdir(paths.librariesDir, { recursive: true }),
    mkdir(paths.assetsDir, { recursive: true }),
    mkdir(paths.runtimeDir, { recursive: true })
  ])
}
