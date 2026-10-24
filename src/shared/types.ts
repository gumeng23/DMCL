export type LoaderType = 'vanilla' | 'fabric' | 'quilt' | 'forge' | 'neoforge' | 'optifine'
export type AccountType = 'offline' | 'microsoft' | 'authlib'
export type DownloadSource = 'auto' | 'official' | 'bmclapi'
export type PageId = 'home' | 'versions' | 'mods' | 'resources' | 'worlds' | 'settings'
export type InstanceTheme = 'grass' | 'sunset' | 'amethyst' | 'ocean' | 'ember' | 'frost'
export type ResourceKind = 'resourcepack' | 'shader'
export type UiTheme = 'dark' | 'light'

export interface Settings {
  gameRoot: string
  javaPath: string
  autoJava: boolean
  memoryMb: number
  minMemoryMb: number
  jvmArgs: string
  downloadSource: DownloadSource
  downloadThreads: number
  closeAfterLaunch: boolean
  minimizeOnLaunch: boolean
  fullscreen: boolean
  resolutionWidth: number
  resolutionHeight: number
  msClientId: string
  authlibInjectorPath: string
  theme: UiTheme
  gameLanguage: string
  skipAccessibility: boolean
  skipMultiplayerWarning: boolean
  showSnapshots: boolean
  showOldVersions: boolean
  checkGameFiles: boolean
}

export interface Instance {
  id: string
  name: string
  versionId: string
  loader: LoaderType
  loaderVersion?: string
  gameDir: string
  memoryMb: number | null
  javaPath: string
  jvmArgs: string
  theme: InstanceTheme
  createdAt: number
  lastPlayed: number
  totalPlayTime: number
  notes: string
}

export interface AccountInfo {
  id: string
  kind: AccountType
  name: string
  uuid: string
  skinModel: 'classic' | 'slim'
  authServer?: string
  avatarUrl?: string
  createdAt: number
  lastUsedAt: number
}

export interface JavaRuntime {
  path: string
  major: number
  version: string
  vendor: string
  arch: string
  source: 'detected' | 'downloaded' | 'custom' | 'bundled'
  managed: boolean
}

export interface VersionSummary {
  id: string
  type: 'release' | 'snapshot' | 'old_beta' | 'old_alpha'
  releaseTime: string
  url?: string
  sha1?: string
}

export interface InstalledVersion {
  id: string
  type: string
  loader: LoaderType
  baseVersion: string
  installedAt: number
  hasJar: boolean
  size: number
  javaMajor: number
  broken?: boolean
}

export interface LoaderOption {
  version: string
  stable: boolean
  gameVersion: string
  type: LoaderType
}

export type TaskStatus = 'queued' | 'running' | 'success' | 'error' | 'cancelled'

export interface TaskProgress {
  id: string
  kind: 'version' | 'loader' | 'java' | 'mod' | 'resource' | 'backup'
  title: string
  stage: string
  current: number
  total: number
  bytes: number
  totalBytes: number
  percent: number
  speed: number
  status: TaskStatus
  message: string
  logs: string[]
  startedAt: number
  finishedAt?: number
  error?: string
}

export interface LaunchState {
  instanceId: string
  status: 'preparing' | 'launching' | 'running' | 'exited' | 'crashed'
  pid?: number
  startedAt?: number
  endedAt?: number
  exitCode?: number
  message?: string
}

export interface LaunchLog {
  instanceId: string
  line: string
  stream: 'stdout' | 'stderr' | 'launcher'
  time: number
}

export interface NewsItem {
  id: string
  title: string
  category: string
  date: string
  text: string
  image: string
  url: string
  java: boolean
}

export interface ModEntry {
  fileName: string
  path: string
  name: string
  version: string
  authors: string
  description: string
  loader: string
  enabled: boolean
  size: number
  icon?: string
  fileNameOnly?: boolean
}

export interface PackEntry {
  kind: ResourceKind
  fileName: string
  path: string
  name: string
  description: string
  format: number
  enabled: boolean
  size: number
  icon?: string
}

export interface WorldEntry {
  folder: string
  name: string
  path: string
  lastPlayed: number
  size: number
  gameMode: string
  hardcore: boolean
  version: string
  icon?: string
  difficulty?: string
}

export interface ModrinthProject {
  projectId: string
  slug: string
  title: string
  description: string
  author: string
  iconUrl: string
  downloads: number
  follows: number
  categories: string[]
  loaders: string[]
  versions: string[]
  projectType: string
  dateModified: string
}

export interface ModrinthVersion {
  id: string
  name: string
  versionNumber: string
  gameVersions: string[]
  loaders: string[]
  datePublished: string
  downloads: number
  fileUrl: string
  fileName: string
  dependencies: Array<{ projectId?: string; versionId?: string; dependencyType: string }>
}

export interface ModrinthSearch {
  hits: ModrinthProject[]
  totalHits: number
  offset: number
  limit: number
}

export interface ModInstallResult {
  installed: string[]
  skipped: string[]
}

export interface AuthlibLoginInput {
  authServer: string
  username: string
  password: string
}

export interface MicrosoftFlow {
  flowId: string
  userCode: string
  verificationUri: string
  expiresIn: number
  interval: number
  message: string
}

export interface AppPaths {
  userData: string
  gameRoot: string
  instancesDir: string
  cacheDir: string
  logsDir: string
  versionsDir: string
  librariesDir: string
  assetsDir: string
  runtimeDir: string
}

export interface BootstrapData {
  settings: Settings
  instances: Instance[]
  accounts: AccountInfo[]
  selectedInstanceId: string
  selectedAccountId: string
  installedVersions: InstalledVersion[]
  javaRuntimes: JavaRuntime[]
  appVersion: string
  platform: string
  paths: AppPaths
  latestRelease?: VersionSummary
  latestSnapshot?: VersionSummary
  online: boolean
  news: NewsItem[]
}

export interface CreateInstanceInput {
  name: string
  versionId: string
  loader: LoaderType
  loaderVersion?: string
  gameDir?: string
  theme?: InstanceTheme
}

export interface InstallVersionInput {
  versionId: string
  loader: LoaderType
  loaderVersion?: string
  instanceId?: string
}

export interface InstallLoaderInput {
  gameVersion: string
  loader: LoaderType
  loaderVersion?: string
  instanceId?: string
}

export interface SystemInfo {
  appVersion: string
  electron: string
  chrome: string
  node: string
  platform: string
  arch: string
  totalMemory: number
  freeMemory: number
  userData: string
  gameRoot: string
}

export interface ToastPayload {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  title: string
  message?: string
}

export interface AmcApi {
  bootstrap(): Promise<BootstrapData>
  refreshNews(): Promise<NewsItem[]>
  systemInfo(): Promise<SystemInfo>
  reportError(message: string): Promise<void>
  window: {
    minimize(): Promise<void>
    toggleMaximize(): Promise<boolean>
    close(): Promise<void>
    isMaximized(): Promise<boolean>
  }
  settings: {
    update(patch: Partial<Settings>): Promise<Settings>
    pickDirectory(defaultPath?: string): Promise<string | null>
    pickFile(kind: 'java' | 'authlib' | 'mod' | 'resourcepack'): Promise<string | null>
  }
  instances: {
    create(input: CreateInstanceInput): Promise<Instance>
    update(id: string, patch: Partial<Instance>): Promise<Instance>
    remove(id: string): Promise<void>
    select(id: string): Promise<void>
    openFolder(id: string): Promise<void>
    duplicate(id: string): Promise<Instance>
  }
  versions: {
    remote(force?: boolean): Promise<VersionSummary[]>
    installed(): Promise<InstalledVersion[]>
    install(input: InstallVersionInput): Promise<{ versionId: string; loader: LoaderType }>
    remove(id: string): Promise<void>
    loaders(gameVersion: string, type: LoaderType): Promise<LoaderOption[]>
    installLoader(input: InstallLoaderInput): Promise<{ versionId: string }>
    cancel(taskId: string): Promise<void>
  }
  java: {
    detect(force?: boolean): Promise<JavaRuntime[]>
    download(major: number): Promise<JavaRuntime>
    openFolder(): Promise<void>
  }
  accounts: {
    addOffline(name: string): Promise<AccountInfo>
    microsoftStart(clientId?: string): Promise<MicrosoftFlow>
    microsoftPoll(flowId: string): Promise<AccountInfo>
    authlibLogin(input: AuthlibLoginInput): Promise<AccountInfo>
    refresh(id: string): Promise<AccountInfo>
    remove(id: string): Promise<void>
    select(id: string): Promise<void>
  }
  mods: {
    list(instanceId: string): Promise<ModEntry[]>
    toggle(instanceId: string, fileName: string): Promise<void>
    remove(instanceId: string, fileName: string): Promise<void>
    import(instanceId: string): Promise<number>
    openFolder(instanceId: string): Promise<void>
    search(query: string, instanceId: string, offset?: number): Promise<ModrinthSearch>
    install(instanceId: string, projectId: string): Promise<ModInstallResult>
    cancel(taskId: string): Promise<void>
  }
  resources: {
    list(instanceId: string, kind: ResourceKind): Promise<PackEntry[]>
    toggle(instanceId: string, kind: ResourceKind, fileName: string): Promise<void>
    remove(instanceId: string, kind: ResourceKind, fileName: string): Promise<void>
    import(instanceId: string, kind: ResourceKind): Promise<number>
    openFolder(instanceId: string, kind: ResourceKind): Promise<void>
  }
  worlds: {
    list(instanceId: string): Promise<WorldEntry[]>
    backup(instanceId: string, folder: string): Promise<string>
    remove(instanceId: string, folder: string): Promise<void>
    openFolder(instanceId: string, folder?: string): Promise<void>
    import(instanceId: string): Promise<number>
  }
  launch: {
    start(instanceId: string): Promise<{ pid: number }>
    stop(instanceId: string): Promise<void>
    running(): Promise<LaunchState[]>
  }
  shell: {
    openPath(path: string): Promise<void>
    openExternal(url: string): Promise<void>
  }
  events: {
    onTask(callback: (task: TaskProgress) => void): () => void
    onLaunchState(callback: (state: LaunchState) => void): () => void
    onLaunchLog(callback: (log: LaunchLog) => void): () => void
    onToast(callback: (toast: ToastPayload) => void): () => void
    onMaximizeChange(callback: (maximized: boolean) => void): () => void
    onAccountsChange(callback: () => void): () => void
  }
}
