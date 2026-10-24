import { createHash, randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { cp, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join, sep } from 'node:path'
import { safeStorage } from 'electron'
import type {
  AccountInfo,
  AccountType,
  CreateInstanceInput,
  Instance,
  InstanceTheme,
  Settings,
  UiTheme
} from '../shared/types'
import {
  appDataDir,
  configFile,
  defaultGameRoot,
  ensureBaseDirs,
  gameInstancesDir,
  legacyGameRoot,
  legacyInstancesDir
} from './paths'
import { logger } from './logger'

export interface StoredAccount extends AccountInfo {
  accessToken?: string
  refreshToken?: string
  expiresAt?: number
  clientToken?: string
  xuid?: string
  msClientId?: string
}

interface ConfigData {
  schema: number
  settings: Settings
  instances: Instance[]
  accounts: StoredAccount[]
  selectedInstanceId: string
  selectedAccountId: string
}

const SCHEMA = 2

export function offlineUuid(name: string): string {
  const hash = createHash('md5').update(`OfflinePlayer:${name}`, 'utf8').digest()
  hash[6] = (hash[6] & 0x0f) | 0x30
  hash[8] = (hash[8] & 0x3f) | 0x80
  const hex = hash.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function defaultSettings(): Settings {
  return {
    gameRoot: defaultGameRoot(),
    javaPath: '',
    autoJava: true,
    memoryMb: 4096,
    minMemoryMb: 1024,
    jvmArgs: '',
    downloadSource: 'auto',
    downloadThreads: 12,
    closeAfterLaunch: false,
    minimizeOnLaunch: false,
    fullscreen: false,
    resolutionWidth: 1280,
    resolutionHeight: 720,
    msClientId: '',
    authlibInjectorPath: '',
    theme: 'dark',
    gameLanguage: 'zh_cn',
    skipAccessibility: true,
    skipMultiplayerWarning: true,
    showSnapshots: true,
    showOldVersions: false,
    checkGameFiles: false
  }
}

function seedConfig(): ConfigData {
  const settings = defaultSettings()
  const instanceId = randomUUID()
  const now = Date.now()
  const accountId = randomUUID()
  const instance: Instance = {
    id: instanceId,
    name: '我的世界',
    versionId: '',
    loader: 'vanilla',
    gameDir: join(settings.gameRoot, 'instances', instanceId),
    memoryMb: null,
    javaPath: '',
    jvmArgs: '',
    theme: 'grass',
    createdAt: now,
    lastPlayed: 0,
    totalPlayTime: 0,
    notes: ''
  }
  const account: StoredAccount = {
    id: accountId,
    kind: 'offline',
    name: 'Steve',
    uuid: offlineUuid('Steve'),
    skinModel: 'classic',
    createdAt: now,
    lastUsedAt: now
  }
  return {
    schema: SCHEMA,
    settings,
    instances: [instance],
    accounts: [account],
    selectedInstanceId: instanceId,
    selectedAccountId: accountId
  }
}

function normalizeSettings(input: Partial<Settings>, base: Settings): Settings {
  const result = { ...base, ...input }
  result.memoryMb = Math.max(512, Math.min(65536, Number(result.memoryMb) || 4096))
  result.minMemoryMb = Math.max(256, Math.min(result.memoryMb, Number(result.minMemoryMb) || 1024))
  result.downloadThreads = Math.max(1, Math.min(32, Number(result.downloadThreads) || 12))
  result.resolutionWidth = Math.max(640, Math.min(7680, Number(result.resolutionWidth) || 1280))
  result.resolutionHeight = Math.max(480, Math.min(4320, Number(result.resolutionHeight) || 720))
  result.downloadSource = ['auto', 'official', 'bmclapi'].includes(result.downloadSource)
    ? result.downloadSource
    : 'auto'
  result.theme = result.theme === 'light' ? 'light' : 'dark'
  result.gameLanguage = typeof result.gameLanguage === 'string' && result.gameLanguage ? result.gameLanguage : 'zh_cn'
  result.skipAccessibility = result.skipAccessibility !== false
  result.skipMultiplayerWarning = result.skipMultiplayerWarning !== false
  return result
}

export class AppStore {
  private data: ConfigData = seedConfig()
  private loaded = false
  private saveChain: Promise<void> = Promise.resolve()

  async init(): Promise<void> {
    await mkdir(join(configFile(), '..'), { recursive: true }).catch(() => undefined)
    let previousSchema = SCHEMA
    try {
      const raw = await readFile(configFile(), 'utf8')
      const parsed = JSON.parse(raw) as Partial<ConfigData>
      previousSchema = Number(parsed.schema) || 1
      this.data = {
        ...seedConfig(),
        ...parsed,
        schema: SCHEMA,
        settings: normalizeSettings(parsed.settings || {}, defaultSettings()),
        instances: Array.isArray(parsed.instances) && parsed.instances.length ? parsed.instances : [],
        accounts: Array.isArray(parsed.accounts) ? parsed.accounts : []
      }
      if (!this.data.instances.length) this.data.instances = seedConfig().instances
      if (!this.data.accounts.length) {
        this.data.accounts = seedConfig().accounts
        this.data.selectedAccountId = this.data.accounts[0].id
      }
      if (!this.data.instances.some((instance) => instance.id === this.data.selectedInstanceId)) {
        this.data.selectedInstanceId = this.data.instances[0]?.id || ''
      }
      if (!this.data.accounts.some((account) => account.id === this.data.selectedAccountId)) {
        this.data.selectedAccountId = this.data.accounts[0]?.id || ''
      }
      // Migrate instance fields from earlier development builds.
      for (const instance of this.data.instances) {
        instance.memoryMb ??= null
        instance.javaPath ??= ''
        instance.jvmArgs ??= ''
        instance.totalPlayTime ??= 0
        instance.notes ??= ''
        instance.theme ??= 'grass'
        instance.gameDir ||= join(this.data.settings.gameRoot, 'instances', instance.id)
      }
      if (previousSchema < 2) {
        await this.migratePortableLayout()
      }
      await this.loadAccountSecrets()
    } catch (error) {
      if (existsSync(configFile())) logger.warn(`配置文件读取失败，将使用默认配置：${String(error)}`)
      this.data = seedConfig()
    }
    this.loaded = true
    try {
      await ensureBaseDirs(this.data.settings)
    } catch (error) {
      const fallback = legacyGameRoot()
      if (this.data.settings.gameRoot === fallback) throw error
      logger.warn(`安装目录不可写，游戏数据改用 ${fallback}：${String(error)}`)
      const oldRoot = this.data.settings.gameRoot
      this.data.settings.gameRoot = fallback
      for (const instance of this.data.instances) {
        if (this.pathInside(instance.gameDir, join(oldRoot, 'instances'))) {
          instance.gameDir = join(fallback, 'instances', instance.id)
        }
      }
      await ensureBaseDirs(this.data.settings)
    }
    for (const instance of this.data.instances) await this.ensureInstanceDir(instance)
    await this.save()
    logger.info(`配置已加载 · 游戏目录 ${this.data.settings.gameRoot}`)
  }

  private pathInside(target: string, base: string): boolean {
    if (!target) return false
    return target.toLowerCase().startsWith(base.toLowerCase() + sep)
  }

  private async migratePortableLayout(): Promise<void> {
    const previousRoot = this.data.settings.gameRoot
    if (previousRoot.toLowerCase() !== legacyGameRoot().toLowerCase()) return

    const newRoot = defaultGameRoot()
    this.data.settings.gameRoot = newRoot
    const oldBase = legacyInstancesDir()
    const newBase = gameInstancesDir(newRoot)
    for (const instance of this.data.instances) {
      if (!this.pathInside(instance.gameDir, oldBase)) continue
      const oldDir = instance.gameDir
      const newDir = join(newBase, instance.id)
      try {
        if (existsSync(oldDir) && !existsSync(newDir)) {
          await mkdir(newBase, { recursive: true })
          await cp(oldDir, newDir, { recursive: true, force: false })
          logger.info(`实例数据已迁移到 ${newDir}`)
        }
        instance.gameDir = newDir
      } catch (error) {
        logger.warn(`实例目录迁移失败，保留原路径：${String(error)}`)
      }
    }
    logger.info(`默认游戏目录已切换为 ${newRoot}`)
  }

  private async ensureInstanceDir(instance: Instance): Promise<void> {
    const gameDir =
      instance.gameDir || join(this.data.settings.gameRoot, 'instances', instance.id)
    await mkdir(gameDir, { recursive: true }).catch(() => undefined)
    if (!instance.gameDir) instance.gameDir = gameDir
  }

  get settings(): Settings {
    return this.data.settings
  }

  get instances(): Instance[] {
    return this.data.instances
  }

  get accounts(): StoredAccount[] {
    return this.data.accounts
  }

  get selectedInstanceId(): string {
    return this.data.selectedInstanceId
  }

  get selectedAccountId(): string {
    return this.data.selectedAccountId
  }

  get selectedInstance(): Instance | undefined {
    return this.data.instances.find((item) => item.id === this.data.selectedInstanceId)
  }

  get selectedAccount(): StoredAccount | undefined {
    return this.data.accounts.find((item) => item.id === this.data.selectedAccountId)
  }

  accountInfo(account: StoredAccount): AccountInfo {
    const { accessToken, refreshToken, expiresAt, clientToken, xuid, msClientId, ...info } = account
    void accessToken
    void refreshToken
    void expiresAt
    void clientToken
    void xuid
    void msClientId
    return info
  }

  publicAccounts(): AccountInfo[] {
    return this.data.accounts.map((account) => this.accountInfo(account))
  }

  private secretsFile(): string {
    return join(appDataDir(), 'secrets.bin')
  }

  private async loadAccountSecrets(): Promise<void> {
    if (!this.data.accounts.length) return
    try {
      if (!existsSync(this.secretsFile())) return
      if (!safeStorage.isEncryptionAvailable()) {
        logger.warn('系统加密不可用，无法读取已保存的账户令牌')
        return
      }
      const encoded = await readFile(this.secretsFile(), 'utf8')
      const json = safeStorage.decryptString(Buffer.from(encoded.trim(), 'base64'))
      const secrets = JSON.parse(json) as Record<string, Partial<StoredAccount>>
      for (const account of this.data.accounts) {
        const secret = secrets[account.id]
        if (!secret) continue
        account.accessToken = secret.accessToken
        account.refreshToken = secret.refreshToken
        account.expiresAt = secret.expiresAt
        account.clientToken = secret.clientToken
        account.xuid = secret.xuid
        account.msClientId = secret.msClientId
      }
    } catch (error) {
      logger.warn(`账户令牌读取失败，需要重新登录：${String(error)}`)
    }
  }

  private async saveAccountSecrets(): Promise<void> {
    const secrets: Record<string, Partial<StoredAccount>> = {}
    for (const account of this.data.accounts) {
      if (!account.accessToken && !account.refreshToken) continue
      secrets[account.id] = {
        accessToken: account.accessToken,
        refreshToken: account.refreshToken,
        expiresAt: account.expiresAt,
        clientToken: account.clientToken,
        xuid: account.xuid,
        msClientId: account.msClientId
      }
    }
    if (!safeStorage.isEncryptionAvailable()) {
      logger.warn('系统加密不可用，本次不会持久化账户令牌')
      return
    }
    const encrypted = safeStorage.encryptString(JSON.stringify(secrets)).toString('base64')
    await writeFile(this.secretsFile(), encrypted, 'utf8')
  }

  async save(): Promise<void> {
    if (!this.loaded) return
    const publicData = {
      ...this.data,
      accounts: this.data.accounts.map((account) => this.accountInfo(account))
    }
    const snapshot = JSON.stringify(publicData, null, 2)
    this.saveChain = this.saveChain.then(async () => {
      const file = configFile()
      const temp = `${file}.tmp`
      await writeFile(temp, snapshot, 'utf8')
      await rename(temp, file)
      await this.saveAccountSecrets()
    })
    await this.saveChain
  }

  async updateSettings(patch: Partial<Settings>): Promise<Settings> {
    const previousRoot = this.data.settings.gameRoot
    this.data.settings = normalizeSettings(patch, this.data.settings)
    if (this.data.settings.gameRoot !== previousRoot) {
      await ensureBaseDirs(this.data.settings)
    }
    await this.save()
    return this.data.settings
  }

  async createInstance(input: CreateInstanceInput): Promise<Instance> {
    const id = randomUUID()
    const theme: InstanceTheme = input.theme || 'grass'
    const instance: Instance = {
      id,
      name: input.name.trim() || `新实例 ${this.data.instances.length + 1}`,
      versionId: input.versionId || '',
      loader: input.loader || 'vanilla',
      loaderVersion: input.loaderVersion,
      gameDir:
        input.gameDir?.trim() || join(this.data.settings.gameRoot, 'instances', id),
      memoryMb: null,
      javaPath: '',
      jvmArgs: '',
      theme,
      createdAt: Date.now(),
      lastPlayed: 0,
      totalPlayTime: 0,
      notes: ''
    }
    await this.ensureInstanceDir(instance)
    this.data.instances.push(instance)
    this.data.selectedInstanceId = instance.id
    await this.save()
    return instance
  }

  async updateInstance(id: string, patch: Partial<Instance>): Promise<Instance> {
    const instance = this.data.instances.find((item) => item.id === id)
    if (!instance) throw new Error('实例不存在')
    const protectedPatch = { ...patch }
    delete protectedPatch.id
    Object.assign(instance, protectedPatch)
    await this.ensureInstanceDir(instance)
    await this.save()
    return instance
  }

  async deleteInstance(id: string): Promise<{ gameDir: string }> {
    const index = this.data.instances.findIndex((item) => item.id === id)
    if (index < 0) throw new Error('实例不存在')
    if (this.data.instances.length <= 1) throw new Error('至少需要保留一个实例')
    const [removed] = this.data.instances.splice(index, 1)
    if (this.data.selectedInstanceId === id) {
      this.data.selectedInstanceId = this.data.instances[Math.max(0, index - 1)]?.id || ''
    }
    await this.save()
    return { gameDir: removed.gameDir }
  }

  async selectInstance(id: string): Promise<void> {
    if (!this.data.instances.some((item) => item.id === id)) throw new Error('实例不存在')
    this.data.selectedInstanceId = id
    await this.save()
  }

  async addAccount(account: Omit<StoredAccount, 'id' | 'createdAt' | 'lastUsedAt'>): Promise<StoredAccount> {
    const now = Date.now()
    const stored: StoredAccount = {
      ...account,
      id: randomUUID(),
      createdAt: now,
      lastUsedAt: now
    }
    const sameKindIndex = this.data.accounts.findIndex(
      (item) => item.kind === account.kind && item.uuid === account.uuid
    )
    if (sameKindIndex >= 0) {
      stored.id = this.data.accounts[sameKindIndex].id
      stored.createdAt = this.data.accounts[sameKindIndex].createdAt
      this.data.accounts[sameKindIndex] = stored
    } else {
      this.data.accounts.push(stored)
    }
    this.data.selectedAccountId = stored.id
    await this.save()
    return stored
  }

  async updateAccount(account: StoredAccount): Promise<void> {
    const index = this.data.accounts.findIndex((item) => item.id === account.id)
    if (index >= 0) this.data.accounts[index] = account
    await this.save()
  }

  async removeAccount(id: string): Promise<void> {
    if (this.data.accounts.length <= 1) throw new Error('至少需要保留一个账户')
    this.data.accounts = this.data.accounts.filter((item) => item.id !== id)
    if (this.data.selectedAccountId === id) {
      this.data.selectedAccountId = this.data.accounts[0]?.id || ''
    }
    await this.save()
  }

  async selectAccount(id: string): Promise<void> {
    const account = this.data.accounts.find((item) => item.id === id)
    if (!account) throw new Error('账户不存在')
    this.data.selectedAccountId = id
    account.lastUsedAt = Date.now()
    await this.save()
  }

  findAccountById(id: string): StoredAccount | undefined {
    return this.data.accounts.find((item) => item.id === id)
  }

  findAccountByKind(kind: AccountType): StoredAccount | undefined {
    return this.data.accounts.find((item) => item.kind === kind)
  }

  async notePlaytime(instanceId: string, seconds: number): Promise<void> {
    const instance = this.data.instances.find((item) => item.id === instanceId)
    if (!instance) return
    instance.lastPlayed = Date.now()
    instance.totalPlayTime = (instance.totalPlayTime || 0) + Math.max(0, Math.round(seconds))
    await this.save()
  }
}

export const store = new AppStore()
