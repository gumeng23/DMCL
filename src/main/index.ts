import { app, BrowserWindow, Menu, nativeTheme, shell } from 'electron'
import { existsSync } from 'node:fs'
import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { store } from './store'
import { registerIpc, sendWindowMaximized, setMainWindow } from './ipc'
import { logger } from './logger'

app.setName('DMCL')

function getArg(prefix: string): string | undefined {
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length)
}

// Portable / development override. The packaged launcher stores its data in %APPDATA%\DMCL.
const dataDirArg = getArg('--data-dir=') || process.env.DMCL_DATA_DIR || process.env.AMCL_DATA_DIR
const defaultDataDir = join(app.getPath('appData'), 'DMCL')
app.setPath('userData', dataDirArg ? resolve(dataDirArg) : defaultDataDir)
app.setAppUserModelId('com.dmcl.launcher')

async function migrateLegacyData(): Promise<void> {
  if (dataDirArg) return
  const legacy = join(app.getPath('appData'), 'AMCL')
  const current = app.getPath('userData')
  if (current.toLowerCase() === legacy.toLowerCase()) return
  if (!existsSync(join(legacy, 'config.json')) || existsSync(join(current, 'config.json'))) return
  await mkdir(current, { recursive: true })
  await copyFile(join(legacy, 'config.json'), join(current, 'config.json'))
  if (existsSync(join(legacy, 'secrets.bin'))) {
    await copyFile(join(legacy, 'secrets.bin'), join(current, 'secrets.bin'))
  }
  logger.info('已从 AMCL 迁移启动器配置')
}

const screenshotPath = getArg('--screenshot=')
const screenshotPage = getArg('--page=')

let mainWindow: BrowserWindow | null = null

function createWindow(): BrowserWindow {
  nativeTheme.themeSource = store.settings.theme === 'light' ? 'light' : 'dark'
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1160,
    minHeight: 720,
    show: false,
    frame: false,
    backgroundColor: '#080b0e',
    autoHideMenuBar: true,
    title: 'DMCL · Minecraft Launcher',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  })

  mainWindow = window
  setMainWindow(window)
  window.setMenuBarVisibility(false)

  window.once('ready-to-show', () => {
    window.show()
    window.focus()
  })

  window.on('maximize', () => sendWindowMaximized(true))
  window.on('unmaximize', () => sendWindowMaximized(false))
  window.on('closed', () => {
    mainWindow = null
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  window.webContents.on('will-navigate', (event, url) => {
    const current = window.webContents.getURL()
    if (url !== current && !url.startsWith('http://localhost') && !url.startsWith('file://')) {
      event.preventDefault()
      if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    }
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  const query = screenshotPage ? `?page=${encodeURIComponent(screenshotPage)}` : ''
  if (devUrl) {
    void window.loadURL(`${devUrl}${query}`)
  } else {
    const options = screenshotPage ? { query: { page: screenshotPage } } : undefined
    void window.loadFile(join(__dirname, '../renderer/index.html'), options)
  }

  if (screenshotPath) {
    window.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        try {
          const image = await window.webContents.capturePage()
          await mkdir(join(screenshotPath, '..'), { recursive: true })
          await writeFile(screenshotPath, image.toPNG())
          logger.info(`截图已保存：${screenshotPath}`)
          app.exit(0)
        } catch (error) {
          logger.error(`截图失败：${String(error)}`)
          app.exit(1)
        }
      }, 2800)
    })
  }

  return window
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock && !screenshotPath) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })

  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null)
    try {
      await migrateLegacyData()
      await store.init()
      registerIpc()
      createWindow()
    } catch (error) {
      logger.error(`启动失败：${String(error)}`)
      app.exit(1)
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin' || screenshotPath) app.quit()
  })
}
