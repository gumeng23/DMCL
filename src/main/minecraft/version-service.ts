import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { InstalledVersion, LoaderOption, LoaderType, VersionSummary } from '../../shared/types'
import { cacheDir, resolvePaths } from '../paths'
import { getBuffer, getJson, getJsonWithFallback, HttpError } from '../http'
import { store } from '../store'
import { logger } from '../logger'
import type {
  VersionJson,
  VersionManifest,
  VersionManifestEntry,
  ResolvedVersion
} from './types'

const MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'
const MANIFEST_MAX_AGE = 1000 * 60 * 10

function manifestCacheFile(): string {
  return join(cacheDir(), 'mojang', 'version_manifest_v2.json')
}

function detailCacheFile(id: string): string {
  return join(cacheDir(), 'mojang', 'versions', `${id}.json`)
}

function installedJsonPath(id: string): string {
  return join(resolvePaths(store.settings).versionsDir, id, `${id}.json`)
}

function loaderFromId(id: string): LoaderType {
  const lower = id.toLowerCase()
  if (lower.includes('neoforge')) return 'neoforge'
  if (lower.includes('optifine')) return 'optifine'
  if (lower.includes('forge')) return 'forge'
  if (lower.includes('quilt')) return 'quilt'
  if (lower.includes('fabric')) return 'fabric'
  return 'vanilla'
}

/** Maps a Minecraft version to the NeoForge Maven version prefix. */
function neoForgePrefix(gameVersion: string): string {
  const parts = gameVersion.split('.')
  if (/^1\.\d+/.test(gameVersion)) {
    const minor = Number(parts[1])
    const patch = Number(parts[2] || 0)
    if (minor === 20 && patch === 1) return '47.1'
    if (minor > 20 || (minor === 20 && patch >= 2)) return `${minor}.${patch}`
    return ''
  }
  if (parts.length >= 2) return `${parts[0]}.${parts[1]}`
  return ''
}

export class VersionService {
  private manifest: VersionManifest | null = null
  private detailMemo = new Map<string, VersionJson>()
  private forgeMetadata: { at: number; versions: string[] } | null = null
  private neoForgeMetadata: { at: number; versions: string[] } | null = null
  private loaderOptionCache = new Map<string, { at: number; options: LoaderOption[] }>()

  async getManifest(force = false): Promise<VersionManifest> {
    if (this.manifest && !force) return this.manifest
    const cacheFile = manifestCacheFile()
    let cached: VersionManifest | null = null
    let cacheAge = Number.POSITIVE_INFINITY
    try {
      const info = await stat(cacheFile)
      cacheAge = Date.now() - info.mtimeMs
      cached = JSON.parse(await readFile(cacheFile, 'utf8')) as VersionManifest
    } catch {
      cached = null
    }
    if (cached && !force && cacheAge < MANIFEST_MAX_AGE) {
      this.manifest = cached
      return cached
    }
    try {
      const fresh = await getJsonWithFallback<VersionManifest>(MANIFEST_URL, store.settings.downloadSource, {
        timeoutMs: 25_000,
        retries: 2
      })
      if (!Array.isArray(fresh.versions)) throw new Error('版本清单格式错误')
      this.manifest = fresh
      await mkdir(dirname(cacheFile), { recursive: true })
      await writeFile(cacheFile, JSON.stringify(fresh), 'utf8')
      return fresh
    } catch (error) {
      if (cached) {
        logger.warn(`远程版本清单获取失败，使用缓存：${String(error)}`)
        this.manifest = cached
        return cached
      }
      throw new Error(`无法获取 Minecraft 版本清单，请检查网络连接。${error instanceof Error ? error.message : ''}`)
    }
  }

  async remoteVersions(force = false): Promise<VersionSummary[]> {
    const manifest = await this.getManifest(force)
    return manifest.versions.map((entry) => ({
      id: entry.id,
      type: entry.type,
      releaseTime: entry.releaseTime,
      url: entry.url,
      sha1: entry.sha1
    }))
  }

  async latestRelease(): Promise<VersionSummary | undefined> {
    try {
      const manifest = await this.getManifest()
      const latest = manifest.versions.find((entry) => entry.id === manifest.latest.release)
      if (!latest) return undefined
      return {
        id: latest.id,
        type: latest.type,
        releaseTime: latest.releaseTime,
        url: latest.url,
        sha1: latest.sha1
      }
    } catch {
      return undefined
    }
  }

  async latestSnapshot(): Promise<VersionSummary | undefined> {
    try {
      const manifest = await this.getManifest()
      const latest = manifest.versions.find((entry) => entry.id === manifest.latest.snapshot)
      if (!latest) return undefined
      return {
        id: latest.id,
        type: latest.type,
        releaseTime: latest.releaseTime,
        url: latest.url,
        sha1: latest.sha1
      }
    } catch {
      return undefined
    }
  }

  async getManifestEntry(id: string): Promise<VersionManifestEntry | undefined> {
    const manifest = await this.getManifest()
    return manifest.versions.find((entry) => entry.id === id)
  }

  async getDetail(id: string, preferInstalled = true): Promise<VersionJson> {
    const memo = this.detailMemo.get(id)
    if (memo) return memo

    if (preferInstalled) {
      const file = installedJsonPath(id)
      if (existsSync(file)) {
        try {
          const detail = JSON.parse(await readFile(file, 'utf8')) as VersionJson
          this.detailMemo.set(id, detail)
          return detail
        } catch {
          // Fall through to cache / network.
        }
      }
    }

    const cacheFile = detailCacheFile(id)
    if (existsSync(cacheFile)) {
      try {
        const detail = JSON.parse(await readFile(cacheFile, 'utf8')) as VersionJson
        this.detailMemo.set(id, detail)
        return detail
      } catch {
        // Ignore invalid cache.
      }
    }

    const entry = await this.getManifestEntry(id)
    if (!entry) throw new Error(`找不到版本 ${id}`)
    const detail = await getJsonWithFallback<VersionJson>(entry.url, store.settings.downloadSource, {
      timeoutMs: 30_000,
      retries: 2
    })
    if (!detail || !detail.id) throw new Error(`版本 ${id} 的元数据无效`)
    this.detailMemo.set(id, detail)
    await mkdir(dirname(cacheFile), { recursive: true })
    await writeFile(cacheFile, JSON.stringify(detail), 'utf8')
    return detail
  }

  async resolve(id: string): Promise<ResolvedVersion> {
    const chain: string[] = []
    const visit = async (versionId: string, depth: number): Promise<ResolvedVersion> => {
      if (depth > 8) throw new Error('版本继承层级异常')
      if (chain.includes(versionId)) throw new Error('版本继承出现循环')
      chain.push(versionId)
      const detail = await this.getDetail(versionId)
      if (detail.inheritsFrom) {
        const parent = await visit(detail.inheritsFrom, depth + 1)
        return this.merge(parent, detail)
      }
      return this.fromJson(detail, chain)
    }
    const result = await visit(id, 0)
    return result
  }

  private fromJson(detail: VersionJson, chain: string[]): ResolvedVersion {
    return {
      id: detail.id,
      type: detail.type,
      mainClass: detail.mainClass,
      jar: detail.jar || detail.id,
      assets: detail.assets || detail.assetIndex?.id || 'legacy',
      assetIndex: detail.assetIndex,
      downloads: detail.downloads || {},
      libraries: detail.libraries || [],
      arguments: detail.arguments || {},
      minecraftArguments: detail.minecraftArguments,
      logging: detail.logging,
      javaVersion: detail.javaVersion,
      inheritsFrom: detail.inheritsFrom,
      chain: [...chain]
    }
  }

  private merge(parent: ResolvedVersion, child: VersionJson): ResolvedVersion {
    const libraryMap = new Map<string, (typeof parent.libraries)[number]>()
    for (const library of parent.libraries) libraryMap.set(library.name, library)
    for (const library of child.libraries || []) libraryMap.set(library.name, library)
    return {
      id: child.id,
      type: child.type || parent.type,
      mainClass: child.mainClass || parent.mainClass,
      jar: child.jar || parent.jar,
      assets: child.assets || child.assetIndex?.id || parent.assets,
      assetIndex: child.assetIndex || parent.assetIndex,
      downloads: { ...parent.downloads, ...(child.downloads || {}) },
      libraries: [...libraryMap.values()],
      arguments: {
        game: [...(parent.arguments.game || []), ...(child.arguments?.game || [])],
        jvm: [...(parent.arguments.jvm || []), ...(child.arguments?.jvm || [])]
      },
      minecraftArguments: child.minecraftArguments || parent.minecraftArguments,
      logging: child.logging || parent.logging,
      javaVersion: child.javaVersion || parent.javaVersion,
      inheritsFrom: child.inheritsFrom,
      chain: parent.chain.includes(child.id) ? parent.chain : [...parent.chain, child.id]
    }
  }

  async installedVersions(): Promise<InstalledVersion[]> {
    const versionsDir = resolvePaths(store.settings).versionsDir
    if (!existsSync(versionsDir)) return []
    const entries = await readdir(versionsDir, { withFileTypes: true }).catch(() => [])
    const result: InstalledVersion[] = []
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const id = entry.name
      const folder = join(versionsDir, id)
      const jsonFile = join(folder, `${id}.json`)
      if (!existsSync(jsonFile)) continue
      try {
        const info = await stat(jsonFile)
        const detail = JSON.parse(await readFile(jsonFile, 'utf8')) as VersionJson
        const jarFile = join(folder, `${detail.jar || id}.jar`)
        const hasJar = existsSync(jarFile)
        result.push({
          id,
          type: detail.type || 'release',
          loader: loaderFromId(id),
          baseVersion: detail.inheritsFrom || id,
          installedAt: info.mtimeMs,
          hasJar,
          size: 0,
          javaMajor: detail.javaVersion?.majorVersion || 8
        })
      } catch {
        // Ignore malformed version folders.
      }
    }
    return result.sort((a, b) => b.installedAt - a.installedAt)
  }

  async isInstalled(id: string): Promise<boolean> {
    return existsSync(installedJsonPath(id))
  }

  invalidate(): void {
    this.detailMemo.clear()
    this.manifest = null
  }

  async loaderOptions(gameVersion: string, type: LoaderType): Promise<LoaderOption[]> {
    const key = `${type}:${gameVersion}`
    const memory = this.loaderOptionCache.get(key)
    if (memory && Date.now() - memory.at < 1000 * 60 * 30) return memory.options
    const cacheFile = this.loaderCacheFile(gameVersion, type)
    try {
      const options = await this.fetchLoaderOptions(gameVersion, type)
      this.loaderOptionCache.set(key, { at: Date.now(), options })
      await mkdir(dirname(cacheFile), { recursive: true })
      await writeFile(cacheFile, JSON.stringify(options), 'utf8')
      return options
    } catch (error) {
      try {
        const cached = JSON.parse(await readFile(cacheFile, 'utf8')) as LoaderOption[]
        if (Array.isArray(cached) && cached.length) {
          logger.warn(`加载器列表请求失败，使用缓存：${type} ${gameVersion}`)
          return cached
        }
      } catch {
        // No cache.
      }
      throw error
    }
  }

  private loaderCacheFile(gameVersion: string, type: LoaderType): string {
    const safe = gameVersion.replace(/[^A-Za-z0-9._-]/g, '_')
    return join(cacheDir(), 'loaders', `${type}-${safe}.json`)
  }

  private async fetchLoaderOptions(gameVersion: string, type: LoaderType): Promise<LoaderOption[]> {
    if (type === 'fabric' || type === 'quilt') {
      const label = type === 'fabric' ? 'Fabric' : 'Quilt'
      const urls =
        type === 'fabric'
          ? [
              `https://meta.fabricmc.net/v2/versions/loader/${encodeURIComponent(gameVersion)}`,
              `https://bmclapi2.bangbang93.com/fabric-meta/v2/versions/loader/${encodeURIComponent(gameVersion)}`
            ]
          : [
              `https://meta.quiltmc.org/v3/versions/loader/${encodeURIComponent(gameVersion)}`
            ]
      let lastError: unknown
      for (const url of urls) {
        let data: Array<{
          loader?: { version?: string; stable?: boolean }
          intermediary?: { version?: string }
        }>
        try {
          data = await getJson(url, { timeoutMs: 10_000, retries: 0 })
        } catch (error) {
          lastError = error
          continue
        }
        if (!Array.isArray(data) || data.length === 0) {
          lastError = new Error('没有返回可用的加载器版本')
          continue
        }
        if (
          type === 'fabric' &&
          data.every((entry) => !entry.intermediary?.version || entry.intermediary.version === '0.0.0')
        ) {
          throw new Error(`${label} 目前尚未支持 Minecraft ${gameVersion}，请使用 1.21.x 等已支持版本`)
        }
        return data
          .filter((entry) => entry.loader?.version)
          .map((entry) => ({
            version: entry.loader!.version!,
            stable: entry.loader!.stable !== false,
            gameVersion,
            type
          }))
      }
      if (lastError instanceof HttpError && [400, 404].includes(lastError.status)) {
        throw new Error(`${label} 尚未支持 Minecraft ${gameVersion}，请换一个游戏版本再试`)
      }
      throw new Error(`${label} 加载器列表获取失败：${lastError instanceof Error ? lastError.message : String(lastError)}`)
    }

    if (type === 'forge') {
      const metadata = await this.getForgeVersions()
      const promotions = await getJson<{ promos?: Record<string, string> }>(
        'https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json',
        { timeoutMs: 20_000, retries: 1 }
      ).catch(() => ({ promos: {} as Record<string, string> }))
      const promos = promotions.promos || {}
      const recommended = promos[`${gameVersion}-recommended`]
      const latest = promos[`${gameVersion}-latest`]
      const versions = metadata
        .filter((entry) => entry.startsWith(`${gameVersion}-`))
        .map((entry) => entry.slice(gameVersion.length + 1))
        .filter((entry) => /^[\d.]+$/.test(entry))
        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
      return versions.map((version) => ({
        version,
        stable: recommended ? version === recommended : version === latest,
        gameVersion,
        type
      }))
    }

    if (type === 'neoforge') {
      const metadata = await this.getNeoForgeVersions()
      const prefix = neoForgePrefix(gameVersion)
      if (!prefix) {
        throw new Error(`没有找到适合 Minecraft ${gameVersion} 的 NeoForge 版本`)
      }
      const versions = metadata
        .filter((entry) => entry.startsWith(`${prefix}.`))
        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
      if (versions.length === 0) {
        throw new Error(`NeoForge 目前不支持 Minecraft ${gameVersion}`)
      }
      return versions.map((version, index) => ({
        version,
        stable: index === 0,
        gameVersion,
        type
      }))
    }

    if (type === 'optifine') {
      const data = await getJson<
        Array<{ mcversion?: string; type?: string; patch?: string; filename?: string }>
      >(`https://bmclapi2.bangbang93.com/optifine/${encodeURIComponent(gameVersion)}`, {
        timeoutMs: 15_000,
        retries: 2
      })
      if (!Array.isArray(data)) return []
      return data
        .filter(
          (entry) =>
            entry.type &&
            entry.patch &&
            entry.filename &&
            !entry.filename.startsWith('preview_')
        )
        .map((entry) => ({
          version: `${entry.type}/${entry.patch}`,
          stable: true,
          gameVersion,
          type
        }))
        .sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }))
    }

    return []
  }

  private async getForgeVersions(): Promise<string[]> {
    if (this.forgeMetadata && Date.now() - this.forgeMetadata.at < 1000 * 60 * 30) {
      return this.forgeMetadata.versions
    }
    const xml = (await getBuffer('https://maven.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml', {
      timeoutMs: 30_000
    })).toString('utf8')
    const versions = [...xml.matchAll(/<version>([^<]+)<\/version>/g)].map((match) => match[1])
    this.forgeMetadata = { at: Date.now(), versions }
    return versions
  }

  private async getNeoForgeVersions(): Promise<string[]> {
    if (this.neoForgeMetadata && Date.now() - this.neoForgeMetadata.at < 1000 * 60 * 30) {
      return this.neoForgeMetadata.versions
    }
    const xml = (
      await getBuffer(
        'https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml',
        { timeoutMs: 30_000 }
      )
    ).toString('utf8')
    const versions = [...xml.matchAll(/<version>([^<]+)<\/version>/g)].map((match) => match[1])
    this.neoForgeMetadata = { at: Date.now(), versions }
    return versions
  }

  async fabricProfile(gameVersion: string, loaderVersion: string): Promise<VersionJson> {
    const urls = [
      `https://meta.fabricmc.net/v2/versions/loader/${encodeURIComponent(
        gameVersion
      )}/${encodeURIComponent(loaderVersion)}/profile/json`,
      `https://bmclapi2.bangbang93.com/fabric-meta/v2/versions/loader/${encodeURIComponent(
        gameVersion
      )}/${encodeURIComponent(loaderVersion)}/profile/json`
    ]
    let lastError: unknown
    for (const url of urls) {
      try {
        const profile = await getJson<VersionJson>(url, { timeoutMs: 18_000, retries: 0 })
        const hasIntermediary = (profile.libraries || []).some(
          (library) =>
            library.name.startsWith('net.fabricmc:intermediary:') &&
            !library.name.endsWith(':0.0.0')
        )
        if (hasIntermediary) return profile
        lastError = new Error(`Fabric 目前尚未支持 Minecraft ${gameVersion}`)
      } catch (error) {
        lastError = error
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error(`Fabric 加载器配置获取失败`)
  }

  async quiltProfile(gameVersion: string, loaderVersion: string): Promise<VersionJson> {
    const url = `https://meta.quiltmc.org/v3/versions/loader/${encodeURIComponent(
      gameVersion
    )}/${encodeURIComponent(loaderVersion)}/profile/json`
    return getJson<VersionJson>(url, { timeoutMs: 25_000, retries: 2 })
  }
}

export const versionService = new VersionService()
