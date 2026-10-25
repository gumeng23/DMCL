import { BrowserWindow, app, dialog, ipcMain, nativeTheme, shell } from 'electron'
import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { freemem, totalmem } from 'node:os'
import { join, resolve, sep } from 'node:path'
import type {
  AccountInfo,
  BootstrapData,
  CreateInstanceInput,
  InstallLoaderInput,
  InstallVersionInput,
  Instance,
  LoaderType,
  Settings,
  SystemInfo
} from '../shared/types'
import { offlineUuid, store } from './store'
import { resolvePaths } from './paths'
import { appEvents } from './events'
import { logger } from './logger'
import { taskManager } from './tasks'
import { versionService } from './minecraft/version-service'
import { installerService } from './minecraft/installer'
import { javaService } from './minecraft/java-service'
import { launchService } from './minecraft/launcher'
import { microsoftAuth } from './auth/microsoft'
import { fetchNews } from './news'

let mainWindow: BrowserWindow | null = null

export function setMainWindow(window: BrowserWindow): void {
  mainWindow = window
}

export function sendWindowMaximized(maximized: boolean): void {
  broadcast('window:maximized', maximized)
}

function broadcast(channel: string, payload?: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send(channel, payload)
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  return Promise.race([
    promise,
    new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), ms))
  ]).catch(() => undefined)
}

function validateVersionPath(id: string): string {
  const versionsDir = resolve(resolvePaths(store.settings).versionsDir)
  const target = resolve(join(versionsDir, id))
  if (!target.startsWith(versionsDir + sep)) throw new Error('非法的版本路径')
  return target
}

function getInstance(instanceId: string): Instance {
  const instance = store.instances.find((item) => item.id === instanceId)
  if (!instance) throw new Error('实例不存在')
  return instance
}

async function bootstrap(): Promise<BootstrapData> {
  const [installed, javaRuntimes, latestRelease, latestSnapshot, news] = await Promise.all([
    versionService.installedVersions(),
    withTimeout(javaService.detect(), 12_000),
    withTimeout(versionService.latestRelease(), 12_000),
    withTimeout(versionService.latestSnapshot(), 12_000),
    withTimeout(fetchNews(), 5000)
  ])

  if (latestRelease) {
    for (const instance of store.instances) {
      if (!instance.versionId) {
        await store.updateInstance(instance.id, { versionId: latestRelease.id })
      }
    }
  }

  return {
    settings: store.settings,
    instances: store.instances,
    accounts: store.publicAccounts(),
    selectedInstanceId: store.selectedInstanceId,
    selectedAccountId: store.selectedAccountId,
    installedVersions: installed,
    javaRuntimes: javaRuntimes || [],
    appVersion: app.getVersion(),
    platform: process.platform,
    paths: resolvePaths(store.settings),
    latestRelease,
    latestSnapshot,
    online: Boolean(latestRelease),
    news: news || []
  }
}

export function registerIpc(): void {
  taskManager.on('task', (task) => broadcast('task:update', task))
  appEvents.on('launch:state', (state) => broadcast('launch:state', state))
  appEvents.on('launch:log', (log) => broadcast('launch:log', log))
  appEvents.on('accounts:changed', () => broadcast('accounts:changed'))

  ipcMain.handle('app:bootstrap', () => bootstrap())

  ipcMain.handle('app:news', () => fetchNews())

  ipcMain.handle('app:system-info', (): SystemInfo => ({
    appVersion: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    platform: process.platform,
    arch: process.arch,
    totalMemory: totalmem(),
    freeMemory: freemem(),
    userData: app.getPath('userData'),
    gameRoot: store.settings.gameRoot
  }))

  ipcMain.handle('app:renderer-error', async (_event, message: string) => {
    logger.error(`Renderer error:\n${String(message).slice(0, 12000)}`)
  })

  ipcMain.handle('window:minimize', () => mainWindow?.minimize())
  ipcMain.handle('window:toggle-maximize', () => {
    if (!mainWindow) return false
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
    return mainWindow.isMaximized()
  })
  ipcMain.handle('window:close', () => mainWindow?.close())
  ipcMain.handle('window:is-maximized', () => mainWindow?.isMaximized() || false)

  ipcMain.handle('settings:update', async (_event, patch: Partial<Settings>) => {
    const settings = await store.updateSettings(patch)
    versionService.invalidate()
    javaService.invalidate()
    nativeTheme.themeSource = settings.theme === 'light' ? 'light' : 'dark'
    return settings
  })

  ipcMain.handle('settings:pick-directory', async (_event, defaultPath?: string) => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      defaultPath: defaultPath || store.settings.gameRoot,
      properties: ['openDirectory', 'createDirectory']
    })
    return result.canceled ? null : result.filePaths[0] || null
  })

  ipcMain.handle('settings:pick-file', async (_event, kind: 'java' | 'authlib' | 'mod' | 'resourcepack') => {
    const filters =
      kind === 'java'
        ? [{ name: 'Java 可执行文件', extensions: ['exe'] }]
        : kind === 'authlib'
          ? [{ name: 'Authlib Injector', extensions: ['jar'] }]
          : [{ name: 'Minecraft 文件', extensions: ['jar', 'zip'] }]
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      filters
    })
    return result.canceled ? null : result.filePaths[0] || null
  })

  ipcMain.handle('instances:create', async (_event, input: CreateInstanceInput) => {
    return store.createInstance(input)
  })

  ipcMain.handle('instances:update', async (_event, id: string, patch: Record<string, unknown>) => {
    return store.updateInstance(id, patch)
  })

  ipcMain.handle('instances:remove', async (_event, id: string) => {
    getInstance(id)
    if (launchService.isRunning(id)) throw new Error('请先结束正在运行的游戏')
    const { gameDir } = await store.deleteInstance(id)
    const base = resolve(resolvePaths(store.settings).instancesDir)
    const target = resolve(gameDir)
    if (target.startsWith(base + sep) && existsSync(target)) {
      await rm(target, { recursive: true, force: true })
    }
  })

  ipcMain.handle('instances:select', async (_event, id: string) => {
    await store.selectInstance(id)
  })

  ipcMain.handle('instances:open-folder', async (_event, id: string) => {
    const instance = getInstance(id)
    await shell.openPath(instance.gameDir)
  })

  ipcMain.handle('instances:duplicate', async (_event, id: string) => {
    const source = getInstance(id)
    return store.createInstance({
      name: `${source.name} 副本`,
      versionId: source.versionId,
      loader: source.loader,
      loaderVersion: source.loaderVersion,
      theme: source.theme
    })
  })

  ipcMain.handle('versions:remote', async (_event, force?: boolean) => {
    return versionService.remoteVersions(Boolean(force))
  })

  ipcMain.handle('versions:installed', async () => versionService.installedVersions())

  ipcMain.handle('versions:loaders', async (_event, gameVersion: string, type: LoaderType) => {
    return versionService.loaderOptions(gameVersion, type)
  })

  ipcMain.handle('versions:install', async (_event, input: InstallVersionInput) => {
    const result = await installerService.installVersion(input)
    if (input.instanceId) {
      await store.updateInstance(input.instanceId, {
        versionId: result.versionId,
        loader: result.loader
      })
    }
    return result
  })

  ipcMain.handle('versions:install-loader', async (_event, input: InstallLoaderInput) => {
    const result = await installerService.installLoader(input)
    if (input.instanceId) {
      await store.updateInstance(input.instanceId, {
        versionId: result.versionId,
        loader: input.loader,
        loaderVersion: input.loaderVersion
      })
      versionService.invalidate()
    }
    return result
  })

  ipcMain.handle('versions:remove', async (_event, id: string) => {
    for (const instance of store.instances) {
      if (instance.versionId === id && launchService.isRunning(instance.id)) {
        throw new Error('有实例正在使用此版本，无法删除')
      }
    }
    const target = validateVersionPath(id)
    if (existsSync(target)) await rm(target, { recursive: true, force: true })
    for (const instance of store.instances) {
      if (instance.versionId === id) await store.updateInstance(instance.id, { versionId: '' })
    }
    versionService.invalidate()
  })

  ipcMain.handle('versions:cancel', async (_event, taskId: string) => {
    taskManager.cancel(taskId)
  })

  ipcMain.handle('java:detect', async (_event, force?: boolean) => {
    javaService.invalidate()
    return javaService.detect(Boolean(force))
  })

  ipcMain.handle('java:download', async (_event, major: number) => {
    return javaService.download(Number(major) || 17)
  })

  ipcMain.handle('java:open-folder', async () => {
    await shell.openPath(resolvePaths(store.settings).runtimeDir)
  })

  ipcMain.handle('accounts:add-offline', async (_event, name: string) => {
    const clean = String(name || '').trim()
    if (!/^[A-Za-z0-9_]{3,16}$/.test(clean)) {
      throw new Error('玩家名需为 3-16 位字母、数字或下划线')
    }
    const stored = await store.addAccount({
      kind: 'offline',
      name: clean,
      uuid: offlineUuid(clean),
      skinModel: 'classic'
    })
    appEvents.emit('accounts:changed')
    return store.accountInfo(stored) as AccountInfo
  })

  ipcMain.handle('accounts:microsoft-start', async (_event, clientId?: string) => {
    const clean = String(clientId || '').trim()
    if (clean && clean !== store.settings.msClientId) {
      await store.updateSettings({ msClientId: clean })
    }
    return microsoftAuth.start(clean)
  })

  ipcMain.handle('accounts:microsoft-browser-login', async (_event, clientId?: string) => {
    const clean = String(clientId || '').trim()
    if (clean && clean !== store.settings.msClientId) {
      await store.updateSettings({ msClientId: clean })
    }
    const account = await microsoftAuth.browserLogin(clean)
    appEvents.emit('accounts:changed')
    return account
  })

  ipcMain.handle('accounts:microsoft-poll', async (_event, flowId: string) => {
    const account = await microsoftAuth.poll(flowId)
    appEvents.emit('accounts:changed')
    return account
  })

  ipcMain.handle('accounts:authlib-login', async () => {
    throw new Error('外置登录将在后续版本接入')
  })

  ipcMain.handle('accounts:refresh', async (_event, id: string) => {
    const account = store.findAccountById(id)
    if (!account) throw new Error('账户不存在')
    if (account.kind === 'microsoft') {
      const refreshed = await microsoftAuth.refresh(account)
      appEvents.emit('accounts:changed')
      return store.accountInfo(refreshed)
    }
    return store.accountInfo(account)
  })

  ipcMain.handle('accounts:remove', async (_event, id: string) => {
    await store.removeAccount(id)
    appEvents.emit('accounts:changed')
  })

  ipcMain.handle('accounts:select', async (_event, id: string) => {
    await store.selectAccount(id)
    appEvents.emit('accounts:changed')
  })

  ipcMain.handle('mods:list', async () => {
    throw new Error('模组管理将在下一阶段接入')
  })
  ipcMain.handle('resources:list', async () => {
    throw new Error('资源包管理将在下一阶段接入')
  })
  ipcMain.handle('worlds:list', async () => {
    throw new Error('存档管理将在下一阶段接入')
  })

  ipcMain.handle('launch:start', async (_event, instanceId: string) => {
    const result = await launchService.launch(instanceId)
    if (store.settings.closeAfterLaunch) {
      setTimeout(() => mainWindow?.hide(), 800)
    } else if (store.settings.minimizeOnLaunch) {
      setTimeout(() => mainWindow?.minimize(), 600)
    }
    return result
  })

  ipcMain.handle('launch:stop', async (_event, instanceId: string) => {
    await launchService.stop(instanceId)
  })

  ipcMain.handle('launch:running', async () => launchService.getStates())

  ipcMain.handle('shell:open-path', async (_event, path: string) => {
    await shell.openPath(String(path))
  })

  ipcMain.handle('shell:open-external', async (_event, url: string) => {
    if (!/^https?:\/\//i.test(url)) throw new Error('仅允许打开网页链接')
    await shell.openExternal(url)
  })
}
