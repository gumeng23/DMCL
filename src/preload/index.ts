import { contextBridge, ipcRenderer } from 'electron'
import type { AmcApi, PageId } from '../shared/types'

function on<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: T): void => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: AmcApi & { debugInitialPage: PageId | null } = {
  bootstrap: () => ipcRenderer.invoke('app:bootstrap'),
  refreshNews: () => ipcRenderer.invoke('app:news'),
  systemInfo: () => ipcRenderer.invoke('app:system-info'),
  reportError: (message) => ipcRenderer.invoke('app:renderer-error', message),
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized')
  },
  settings: {
    update: (patch) => ipcRenderer.invoke('settings:update', patch),
    pickDirectory: (defaultPath) => ipcRenderer.invoke('settings:pick-directory', defaultPath),
    pickFile: (kind) => ipcRenderer.invoke('settings:pick-file', kind)
  },
  instances: {
    create: (input) => ipcRenderer.invoke('instances:create', input),
    update: (id, patch) => ipcRenderer.invoke('instances:update', id, patch),
    remove: (id) => ipcRenderer.invoke('instances:remove', id),
    select: (id) => ipcRenderer.invoke('instances:select', id),
    openFolder: (id) => ipcRenderer.invoke('instances:open-folder', id),
    duplicate: (id) => ipcRenderer.invoke('instances:duplicate', id)
  },
  versions: {
    remote: (force) => ipcRenderer.invoke('versions:remote', force),
    installed: () => ipcRenderer.invoke('versions:installed'),
    install: (input) => ipcRenderer.invoke('versions:install', input),
    remove: (id) => ipcRenderer.invoke('versions:remove', id),
    loaders: (gameVersion, type) => ipcRenderer.invoke('versions:loaders', gameVersion, type),
    installLoader: (input) => ipcRenderer.invoke('versions:install-loader', input),
    cancel: (taskId) => ipcRenderer.invoke('versions:cancel', taskId)
  },
  java: {
    detect: (force) => ipcRenderer.invoke('java:detect', force),
    download: (major) => ipcRenderer.invoke('java:download', major),
    openFolder: () => ipcRenderer.invoke('java:open-folder')
  },
  accounts: {
    addOffline: (name) => ipcRenderer.invoke('accounts:add-offline', name),
    microsoftStart: (clientId) => ipcRenderer.invoke('accounts:microsoft-start', clientId),
    microsoftBrowserLogin: (clientId) =>
      ipcRenderer.invoke('accounts:microsoft-browser-login', clientId),
    microsoftPoll: (flowId) => ipcRenderer.invoke('accounts:microsoft-poll', flowId),
    authlibLogin: (input) => ipcRenderer.invoke('accounts:authlib-login', input),
    refresh: (id) => ipcRenderer.invoke('accounts:refresh', id),
    remove: (id) => ipcRenderer.invoke('accounts:remove', id),
    select: (id) => ipcRenderer.invoke('accounts:select', id)
  },
  mods: {
    list: (instanceId) => ipcRenderer.invoke('mods:list', instanceId),
    toggle: (instanceId, fileName) => ipcRenderer.invoke('mods:toggle', instanceId, fileName),
    remove: (instanceId, fileName) => ipcRenderer.invoke('mods:remove', instanceId, fileName),
    import: (instanceId) => ipcRenderer.invoke('mods:import', instanceId),
    openFolder: (instanceId) => ipcRenderer.invoke('mods:open-folder', instanceId),
    search: (query, instanceId, offset) => ipcRenderer.invoke('mods:search', query, instanceId, offset),
    install: (instanceId, projectId) => ipcRenderer.invoke('mods:install', instanceId, projectId),
    cancel: (taskId) => ipcRenderer.invoke('mods:cancel', taskId)
  },
  resources: {
    list: (instanceId, kind) => ipcRenderer.invoke('resources:list', instanceId, kind),
    toggle: (instanceId, kind, fileName) => ipcRenderer.invoke('resources:toggle', instanceId, kind, fileName),
    remove: (instanceId, kind, fileName) => ipcRenderer.invoke('resources:remove', instanceId, kind, fileName),
    import: (instanceId, kind) => ipcRenderer.invoke('resources:import', instanceId, kind),
    openFolder: (instanceId, kind) => ipcRenderer.invoke('resources:open-folder', instanceId, kind)
  },
  worlds: {
    list: (instanceId) => ipcRenderer.invoke('worlds:list', instanceId),
    backup: (instanceId, folder) => ipcRenderer.invoke('worlds:backup', instanceId, folder),
    remove: (instanceId, folder) => ipcRenderer.invoke('worlds:remove', instanceId, folder),
    openFolder: (instanceId, folder) => ipcRenderer.invoke('worlds:open-folder', instanceId, folder),
    import: (instanceId) => ipcRenderer.invoke('worlds:import', instanceId)
  },
  launch: {
    start: (instanceId) => ipcRenderer.invoke('launch:start', instanceId),
    stop: (instanceId) => ipcRenderer.invoke('launch:stop', instanceId),
    running: () => ipcRenderer.invoke('launch:running')
  },
  shell: {
    openPath: (path) => ipcRenderer.invoke('shell:open-path', path),
    openExternal: (url) => ipcRenderer.invoke('shell:open-external', url)
  },
  events: {
    onTask: (callback) => on('task:update', callback),
    onLaunchState: (callback) => on('launch:state', callback),
    onLaunchLog: (callback) => on('launch:log', callback),
    onToast: (callback) => on('app:toast', callback),
    onMaximizeChange: (callback) => on('window:maximized', callback),
    onAccountsChange: (callback) => on('accounts:changed', callback)
  },
  debugInitialPage: null as PageId | null
}

contextBridge.exposeInMainWorld('amc', api)
