import AdmZip from 'adm-zip'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { app } from 'electron'
import type { InstallLoaderInput, InstallVersionInput, LoaderType } from '../../shared/types'
import { downloadFile, downloadMany, downloadWithFallback, getJson, getJsonWithFallback } from '../http'
import { ensureBaseDirs, resolvePaths } from '../paths'
import { store } from '../store'
import { isAbortError, taskManager, type TaskHandle } from '../tasks'
import { logger } from '../logger'
import { currentRuleContext, rulesAllow } from './rules'
import type { AssetIndex, LibraryDownloads, ResolvedVersion, VersionJson, VersionLibrary } from './types'
import { versionService } from './version-service'
import { javaService } from './java-service'

interface ArtifactTask {
  path: string
  url: string
  sha1?: string
  size?: number
  exclude?: string[]
  native: boolean
}

function mavenToPath(name: string): string {
  const [coordinates, extension = 'jar'] = name.split('@')
  const [group, artifact, version, classifier] = coordinates.split(':')
  if (!group || !artifact || !version) throw new Error(`无法解析依赖坐标：${name}`)
  const fileName = `${artifact}-${version}${classifier ? `-${classifier}` : ''}.${extension}`
  return `${group.replace(/\./g, '/')}/${artifact}/${version}/${fileName}`
}

function mavenUrl(base: string | undefined, path: string): string {
  const root = (base || 'https://libraries.minecraft.net/').replace(/\/?$/, '/')
  return `${root}${path}`
}

function nativeClassifier(library: VersionLibrary): string | undefined {
  if (!library.natives) return undefined
  const key = library.natives.windows
  if (!key) return undefined
  return key.replace('${arch}', process.arch === 'ia32' ? '32' : '64')
}

function libraryDownloads(library: VersionLibrary): LibraryDownloads {
  return library.downloads || {}
}

function guessJavaMajor(versionId: string): number {
  if (/^1\.(20\.(5|6)|21)/.test(versionId)) return 21
  if (/^1\.(18|19|20)/.test(versionId)) return 17
  if (versionId === '1.17' || versionId.startsWith('1.17.')) return 16
  return 8
}

function collectLibraries(detail: ResolvedVersion): ArtifactTask[] {
  const context = currentRuleContext()
  const artifacts = new Map<string, ArtifactTask>()
  for (const library of detail.libraries) {
    if (!rulesAllow(library.rules, context)) continue
    const downloads = libraryDownloads(library)
    const artifact = downloads.artifact
    const path = artifact?.path || mavenToPath(library.name)
    if (!artifacts.has(path)) {
      artifacts.set(path, {
        path,
        url: artifact?.url || mavenUrl(library.url, path),
        sha1: artifact?.sha1,
        size: artifact?.size,
        native: false
      })
    }
    const classifier = nativeClassifier(library)
    if (classifier) {
      const nativeDownload = downloads.classifiers?.[classifier]
      const nativePath =
        nativeDownload?.path ||
        mavenToPath(`${library.name}:${classifier}`)
      if (!artifacts.has(nativePath)) {
        artifacts.set(nativePath, {
          path: nativePath,
          url: nativeDownload?.url || mavenUrl(library.url, nativePath),
          sha1: nativeDownload?.sha1,
          size: nativeDownload?.size,
          exclude: library.extract?.exclude,
          native: true
        })
      }
    }
  }
  return [...artifacts.values()]
}

export class InstallerService {
  async installVersion(input: InstallVersionInput): Promise<{ versionId: string; loader: LoaderType }> {
    if (input.loader !== 'vanilla') {
      const result = await this.installLoader({
        gameVersion: input.versionId,
        loader: input.loader,
        loaderVersion: input.loaderVersion,
        instanceId: input.instanceId,
        installApi: input.installApi
      })
      return { versionId: result.versionId, loader: input.loader }
    }
    const task = taskManager.create('version', `安装 Minecraft ${input.versionId}`)
    try {
      await ensureBaseDirs(store.settings)
      await this.installBaseVersion(input.versionId, task)
      task.success(`Minecraft ${input.versionId} 安装完成`)
      return { versionId: input.versionId, loader: 'vanilla' }
    } catch (error) {
      this.failTask(task, error)
      throw error
    }
  }

  async ensureBaseVersion(versionId: string, task: TaskHandle): Promise<void> {
    if (!(await versionService.isInstalled(versionId))) {
      await this.installBaseVersion(versionId, task)
    } else {
      const detail = await versionService.getDetail(versionId)
      await this.writeVersionJson(versionId, detail)
      await this.ensureResolvedFiles(await versionService.resolve(versionId), task, true)
      task.log(`原版 ${versionId} 已存在，已检查完整性`)
    }
  }

  private async installBaseVersion(versionId: string, task: TaskHandle): Promise<void> {
    task.update({ stage: '获取版本信息', message: `正在解析 ${versionId}`, current: 0, total: 0 })
    const detail = await versionService.getDetail(versionId, false)
    await this.writeVersionJson(versionId, detail)
    task.log(`版本元数据获取成功：${versionId}`)
    const resolved = await versionService.resolve(versionId)
    await this.ensureResolvedFiles(resolved, task, true)
  }

  private async writeVersionJson(versionId: string, detail: VersionJson): Promise<void> {
    const paths = resolvePaths(store.settings)
    const folder = join(paths.versionsDir, versionId)
    await mkdir(folder, { recursive: true })
    await writeFile(join(folder, `${versionId}.json`), JSON.stringify(detail, null, 2), 'utf8')
  }

  private async ensureResolvedFiles(
    detail: ResolvedVersion,
    task: TaskHandle,
    includeClient: boolean
  ): Promise<void> {
    const paths = resolvePaths(store.settings)
    const clientInfo = detail.downloads.client
    if (includeClient && clientInfo) {
      const jarPath = join(paths.versionsDir, detail.jar, `${detail.jar}.jar`)
      task.update({
        stage: '下载客户端',
        message: `Minecraft ${detail.jar}.jar`,
        current: 0,
        total: 1,
        bytes: 0,
        totalBytes: clientInfo.size || 0
      })
      const result = await downloadWithFallback(clientInfo.url, jarPath, store.settings.downloadSource, {
        sha1: clientInfo.sha1,
        size: clientInfo.size,
        signal: task.signal,
        verifyHash: true,
        onProgress: (received, total) =>
          task.update({
            bytes: received,
            totalBytes: total || clientInfo.size || 0,
            message: `客户端 ${(received / 1024 / 1024).toFixed(1)} MB`
          })
      })
      task.update({ current: 1, bytes: result.bytes, totalBytes: result.bytes })
      task.log(result.skipped ? '客户端已存在，跳过下载' : '客户端下载完成')
    }

    await this.ensureLibraries(detail, task)
    await this.ensureAssets(detail, task)
    await this.ensureLoggingConfig(detail, task)
  }

  private async ensureLibraries(detail: ResolvedVersion, task: TaskHandle): Promise<void> {
    const paths = resolvePaths(store.settings)
    const artifacts = collectLibraries(detail)
    const natives = artifacts.filter((item) => item.native)
    const total = artifacts.length
    let downloaded = 0
    let bytes = 0
    let lastMessage = ''
    task.update({
      stage: '下载依赖库',
      message: `共 ${total} 个依赖`,
      current: 0,
      total,
      bytes: 0,
      totalBytes: artifacts.reduce((sum, item) => sum + (item.size || 0), 0)
    })

    await downloadMany(
      artifacts,
      Math.max(2, Math.min(8, store.settings.downloadThreads)),
      task.signal,
      async (artifact) => {
        const destination = join(paths.librariesDir, artifact.path)
        const result = await downloadWithFallback(artifact.url, destination, store.settings.downloadSource, {
          sha1: artifact.sha1,
          size: artifact.size,
          signal: task.signal,
          verifyHash: store.settings.checkGameFiles
        })
        downloaded++
        bytes += result.bytes
        lastMessage = artifact.path.split('/').pop() || artifact.path
        task.update({ current: downloaded, bytes, message: lastMessage })
      }
    )
    task.log(`依赖库检查完成，共 ${total} 个文件`)

    if (natives.length) {
      task.update({ stage: '解压运行库', current: 0, total: natives.length, percent: undefined })
      const nativesDir = join(paths.versionsDir, detail.id, 'natives')
      await rm(nativesDir, { recursive: true, force: true })
      await mkdir(nativesDir, { recursive: true })
      let extracted = 0
      for (const artifact of natives) {
        const archive = join(paths.librariesDir, artifact.path)
        try {
          const zip = new AdmZip(archive)
          for (const entry of zip.getEntries()) {
            if (entry.isDirectory) continue
            const entryName = entry.entryName.replace(/\\/g, '/')
            if (entryName.startsWith('META-INF/')) continue
            if (artifact.exclude?.some((part) => entryName.startsWith(part))) continue
            const baseName = entryName.split('/').pop() || ''
            if (!baseName) continue
            const target = join(nativesDir, baseName)
            await writeFile(target, entry.getData())
          }
        } catch (error) {
          task.log(`运行库解压失败：${artifact.path} · ${String(error)}`)
        }
        extracted++
        task.update({ current: extracted, percent: (extracted / natives.length) * 100 })
      }
      task.log(`已释放 ${natives.length} 个运行库`)
    }
  }

  private async ensureAssets(detail: ResolvedVersion, task: TaskHandle): Promise<void> {
    const assetIndex = detail.assetIndex
    if (!assetIndex) return
    const paths = resolvePaths(store.settings)
    const indexFile = join(paths.assetsDir, 'indexes', `${assetIndex.id}.json`)
    task.update({
      stage: '下载资源索引',
      message: assetIndex.id,
      current: 0,
      total: 1,
      bytes: 0,
      totalBytes: assetIndex.size || 0
    })
    await downloadWithFallback(assetIndex.url, indexFile, store.settings.downloadSource, {
      sha1: assetIndex.sha1,
      size: assetIndex.size,
      signal: task.signal,
      verifyHash: true
    })

    let index: AssetIndex
    try {
      index = JSON.parse(await readFile(indexFile, 'utf8')) as AssetIndex
    } catch {
      throw new Error('资源索引解析失败')
    }
    const objects = index.objects || {}
    const uniqueHashes = new Map<string, { hash: string; size: number }>()
    for (const object of Object.values(objects)) {
      if (object?.hash && !uniqueHashes.has(object.hash)) uniqueHashes.set(object.hash, object)
    }
    const items = [...uniqueHashes.values()]
    const total = items.length
    let downloaded = 0
    let bytes = 0
    task.update({
      stage: '下载游戏资源',
      message: `共 ${total} 个资源文件`,
      current: 0,
      total,
      bytes: 0,
      totalBytes: items.reduce((sum, object) => sum + (object.size || 0), 0)
    })

    await downloadMany(
      items,
      Math.max(4, Math.min(24, store.settings.downloadThreads * 2)),
      task.signal,
      async (object) => {
        const destination = join(paths.assetsDir, 'objects', object.hash.slice(0, 2), object.hash)
        const url = `https://resources.download.minecraft.net/${object.hash.slice(0, 2)}/${object.hash}`
        const result = await downloadWithFallback(url, destination, store.settings.downloadSource, {
          sha1: object.hash,
          size: object.size,
          signal: task.signal,
          verifyHash: false
        })
        downloaded++
        bytes += result.bytes
        task.update({ current: downloaded, bytes, message: `${downloaded} / ${total}` })
      }
    )
    task.log(`游戏资源检查完成，共 ${total} 个文件`)

    if (index.virtual || index.map_to_resources) {
      task.update({ stage: '整理旧版资源', current: 0, total: Object.keys(objects).length })
      const targetRoot = index.map_to_resources
        ? join(paths.gameRoot, 'resources')
        : join(paths.assetsDir, 'virtual', index.id)
      let copied = 0
      for (const [name, object] of Object.entries(objects)) {
        const source = join(paths.assetsDir, 'objects', object.hash.slice(0, 2), object.hash)
        const destination = join(targetRoot, ...name.split('/'))
        await mkdir(dirname(destination), { recursive: true })
        try {
          await copyFile(source, destination)
        } catch {
          // Some legacy indexes reference files that are no longer published.
        }
        copied++
        if (copied % 50 === 0) task.update({ current: copied })
      }
      task.log('旧版资源目录整理完成')
    }
  }

  private async ensureLoggingConfig(detail: ResolvedVersion, task: TaskHandle): Promise<void> {
    const logging = detail.logging?.client?.file
    if (!logging?.url) return
    const paths = resolvePaths(store.settings)
    const destination = join(paths.assetsDir, 'log_configs', logging.id)
    await downloadWithFallback(logging.url, destination, store.settings.downloadSource, {
      sha1: logging.sha1,
      size: logging.size,
      signal: task.signal,
      verifyHash: true
    }).catch((error) => {
      task.log(`日志配置下载失败，游戏仍可启动：${String(error)}`)
    })
  }

  async installLoader(input: InstallLoaderInput): Promise<{ versionId: string }> {
    const labels: Record<LoaderType, string> = {
      vanilla: '原版',
      fabric: 'Fabric',
      quilt: 'Quilt',
      forge: 'Forge',
      neoforge: 'NeoForge',
      optifine: 'OptiFine'
    }
    const task = taskManager.create(
      'loader',
      `安装 ${labels[input.loader]} · ${input.gameVersion}`
    )
    try {
      await ensureBaseDirs(store.settings)
      let loaderVersion = input.loaderVersion
      if (!loaderVersion) {
        task.update({ stage: '获取加载器列表', message: '正在查询可用版本' })
        const options = await versionService.loaderOptions(input.gameVersion, input.loader)
        const preferred = options.find((item) => item.stable) || options[0]
        if (!preferred) throw new Error('该游戏版本没有可用的加载器版本')
        loaderVersion = preferred.version
      }
      task.log(`加载器版本：${loaderVersion}`)
      task.update({ stage: '安装原版依赖', message: `Minecraft ${input.gameVersion}` })
      await this.ensureBaseVersion(input.gameVersion, task)

      if (input.loader === 'forge') {
        const versionId = await this.installForge(input.gameVersion, loaderVersion, task)
        task.success(`Forge ${loaderVersion} 安装完成`)
        return { versionId }
      }
      if (input.loader === 'neoforge') {
        const versionId = await this.installNeoForge(input.gameVersion, loaderVersion, task)
        task.success(`NeoForge ${loaderVersion} 安装完成`)
        return { versionId }
      }
      if (input.loader === 'optifine') {
        const versionId = await this.installOptiFine(input.gameVersion, loaderVersion, task)
        task.success(`OptiFine ${loaderVersion.replace('/', ' ')} 安装完成`)
        return { versionId }
      }

      task.update({ stage: '获取加载器配置', message: loaderVersion, percent: undefined })
      const profile =
        input.loader === 'fabric'
          ? await versionService.fabricProfile(input.gameVersion, loaderVersion)
          : await versionService.quiltProfile(input.gameVersion, loaderVersion)
      if (!profile.id) throw new Error('加载器配置无效')
      if (!profile.inheritsFrom) profile.inheritsFrom = input.gameVersion
      const paths = resolvePaths(store.settings)
      const folder = join(paths.versionsDir, profile.id)
      await mkdir(folder, { recursive: true })
      await writeFile(join(folder, `${profile.id}.json`), JSON.stringify(profile, null, 2), 'utf8')
      task.log(`写入版本配置：${profile.id}`)
      versionService.invalidate()
      const resolved = await versionService.resolve(profile.id)
      const artifacts = collectLibraries(resolved)
      let downloaded = 0
      const total = artifacts.length
      task.update({
        stage: '下载加载器组件',
        message: `共 ${total} 个组件`,
        current: 0,
        total,
        bytes: 0,
        totalBytes: artifacts.reduce((sum, item) => sum + (item.size || 0), 0)
      })
      await downloadMany(
        artifacts,
        Math.max(2, Math.min(8, store.settings.downloadThreads)),
        task.signal,
        async (artifact) => {
          await downloadWithFallback(
            artifact.url,
            join(paths.librariesDir, artifact.path),
            store.settings.downloadSource,
            {
              sha1: artifact.sha1,
              size: artifact.size,
              signal: task.signal,
              verifyHash: store.settings.checkGameFiles
            }
          )
          downloaded++
          task.update({
            current: downloaded,
            message: artifact.path.split('/').pop() || artifact.path
          })
        }
      )
      let companionNote = ''
      if (input.installApi && (input.loader === 'fabric' || input.loader === 'quilt')) {
        const companion = await this.installCompanionApi(
          input.loader,
          input.gameVersion,
          input.instanceId,
          task
        )
        if (!companion.ok) companionNote = `；API 未安装：${companion.message}`
      }
      task.success(`${labels[input.loader]} 安装完成${companionNote}`)
      return { versionId: profile.id }
    } catch (error) {
      this.failTask(task, error)
      throw error
    }
  }

  private async installForge(
    gameVersion: string,
    forgeVersion: string,
    task: TaskHandle
  ): Promise<string> {
    const paths = resolvePaths(store.settings)
    const fullVersion = `${gameVersion}-${forgeVersion}`
    const installerName = `forge-${fullVersion}-installer.jar`
    const installerPath = join(paths.cacheDir, 'installers', installerName)
    const url = `https://maven.minecraftforge.net/net/minecraftforge/forge/${fullVersion}/forge-${fullVersion}-installer.jar`

    task.update({
      stage: '下载 Forge 安装器',
      message: installerName,
      current: 0,
      total: 1,
      bytes: 0,
      totalBytes: 0,
      percent: undefined
    })
    await downloadWithFallback(url, installerPath, store.settings.downloadSource, {
      signal: task.signal,
      retries: 3,
      onProgress: (received, total) =>
        task.update({
          bytes: received,
          totalBytes: total,
          percent: total ? (received / total) * 100 : undefined,
          message: `${(received / 1024 / 1024).toFixed(1)} MB`
        })
    })
    if (!existsSync(installerPath)) throw new Error('Forge 安装器下载失败')
    task.log('Forge 安装器下载完成')

    const javaPath = await this.resolveInstallerJava(gameVersion, task)
    await this.ensureLauncherProfiles(paths.gameRoot)
    task.update({
      stage: '运行 Forge 安装器',
      message: '正在下载并打补丁，请稍候…',
      current: 0,
      total: 0,
      percent: undefined
    })
    const output = await this.runJavaInstaller(
      javaPath,
      ['-Duser.language=en', '-jar', installerPath, '--installClient', paths.gameRoot],
      paths.gameRoot,
      task
    )
    if (!/Successfully installed/i.test(output)) {
      task.log('安装器没有返回成功标志，正在检查版本目录…')
    }
    const versionId = await this.findLatestInstalled(gameVersion, (id) =>
      id.toLowerCase().includes('forge')
    )
    if (!versionId) throw new Error('Forge 安装结束，但没有找到生成的版本配置')
    versionService.invalidate()
    task.log(`Forge 版本已创建：${versionId}`)
    return versionId
  }

  private async installNeoForge(
    gameVersion: string,
    neoForgeVersion: string,
    task: TaskHandle
  ): Promise<string> {
    const paths = resolvePaths(store.settings)
    const installerName = `neoforge-${neoForgeVersion}-installer.jar`
    const installerPath = join(paths.cacheDir, 'installers', installerName)
    const url = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${neoForgeVersion}/neoforge-${neoForgeVersion}-installer.jar`

    task.update({
      stage: '下载 NeoForge 安装器',
      message: installerName,
      current: 0,
      total: 1,
      bytes: 0,
      totalBytes: 0,
      percent: undefined
    })
    await downloadWithFallback(url, installerPath, store.settings.downloadSource, {
      signal: task.signal,
      retries: 3,
      onProgress: (received, total) =>
        task.update({
          bytes: received,
          totalBytes: total,
          percent: total ? (received / total) * 100 : undefined,
          message: `${(received / 1024 / 1024).toFixed(1)} MB`
        })
    })
    if (!existsSync(installerPath)) throw new Error('NeoForge 安装器下载失败')
    task.log('NeoForge 安装器下载完成')

    const javaPath = await this.resolveInstallerJava(gameVersion, task)
    await this.ensureLauncherProfiles(paths.gameRoot)
    task.update({
      stage: '运行 NeoForge 安装器',
      message: '正在下载并打补丁，请稍候…',
      current: 0,
      total: 0,
      percent: undefined
    })
    const output = await this.runJavaInstaller(
      javaPath,
      ['-Duser.language=en', '-jar', installerPath, '--installClient', paths.gameRoot],
      paths.gameRoot,
      task
    )
    if (!/Successfully installed/i.test(output)) {
      task.log('安装器没有返回成功标志，正在检查版本目录…')
    }
    const versionId = await this.findLatestInstalled(gameVersion, (id) =>
      id.toLowerCase().includes('neoforge')
    )
    if (!versionId) throw new Error('NeoForge 安装结束，但没有找到生成的版本配置')
    versionService.invalidate()
    task.log(`NeoForge 版本已创建：${versionId}`)
    return versionId
  }

  private async installCompanionApi(
    loader: 'fabric' | 'quilt',
    gameVersion: string,
    instanceId: string | undefined,
    task: TaskHandle
  ): Promise<{ ok: boolean; message: string }> {
    const instance =
      (instanceId ? store.instances.find((item) => item.id === instanceId) : undefined) ||
      store.selectedInstance
    if (!instance) return { ok: false, message: '没有可用的游戏实例' }
    const modsDir = join(instance.gameDir, 'mods')
    await mkdir(modsDir, { recursive: true })

    const attempts =
      loader === 'fabric'
        ? [{ slug: 'fabric-api', loader: 'fabric' }]
        : [
            { slug: 'quilted-fabric-api', loader: 'quilt' },
            { slug: 'fabric-api', loader: 'quilt' }
          ]

    task.update({
      stage: '下载前置 API',
      message: loader === 'fabric' ? 'Fabric API' : 'Quilted Fabric API',
      current: 0,
      total: 1,
      bytes: 0,
      totalBytes: 0,
      percent: undefined
    })

    let lastError = ''
    for (const attempt of attempts) {
      try {
        const loaders = encodeURIComponent(JSON.stringify([attempt.loader]))
        const versions = encodeURIComponent(JSON.stringify([gameVersion]))
        const url = `https://api.modrinth.com/v2/project/${attempt.slug}/version?loaders=${loaders}&game_versions=${versions}`
        const list = await getJson<
          Array<{
            version_number?: string
            files?: Array<{
              url?: string
              filename?: string
              primary?: boolean
              size?: number
              hashes?: { sha1?: string }
            }>
          }>
        >(url, { timeoutMs: 20_000, retries: 2 })
        const version = Array.isArray(list) ? list.find((item) => item.files?.length) : undefined
        const file = version?.files?.find((item) => item.primary) || version?.files?.[0]
        if (!file?.url || !file.filename) {
          lastError = `没有找到适配 Minecraft ${gameVersion} 的 ${attempt.slug}`
          continue
        }
        const fileName = basename(file.filename)
        const destination = join(modsDir, fileName)
        const result = await downloadFile(file.url, destination, {
          signal: task.signal,
          sha1: file.hashes?.sha1,
          size: file.size,
          retries: 3,
          onProgress: (received, total) =>
            task.update({
              bytes: received,
              totalBytes: total,
              percent: total ? (received / total) * 100 : undefined,
              message: fileName
            })
        })
        task.log(`${attempt.slug} ${version?.version_number || ''} 已安装到 mods`)
        task.update({ current: 1, percent: 100, bytes: result.bytes, totalBytes: result.bytes })
        return { ok: true, message: fileName }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
      }
    }
    task.log(`前置 API 下载失败：${lastError}`)
    return { ok: false, message: lastError || '下载失败' }
  }

  private async installOptiFine(
    gameVersion: string,
    loaderVersion: string,
    task: TaskHandle
  ): Promise<string> {
    const [type, patch] = loaderVersion.split('/')
    if (!type || !patch) throw new Error('OptiFine 版本格式无效')
    const paths = resolvePaths(store.settings)
    const fileName = `OptiFine_${gameVersion}_${type}_${patch}.jar`
    const installerPath = join(paths.cacheDir, 'installers', fileName)
    const url = `https://bmclapi2.bangbang93.com/optifine/${gameVersion}/${type}/${patch}`
    task.update({
      stage: '下载 OptiFine',
      message: fileName,
      current: 0,
      total: 1,
      bytes: 0,
      totalBytes: 0,
      percent: undefined
    })
    await downloadWithFallback(url, installerPath, 'official', {
      signal: task.signal,
      retries: 3,
      onProgress: (received, total) =>
        task.update({
          bytes: received,
          totalBytes: total,
          percent: total ? (received / total) * 100 : undefined,
          message: `${(received / 1024 / 1024).toFixed(1)} MB`
        })
    })
    if (!existsSync(installerPath)) throw new Error('OptiFine 下载失败')

    const bridge = join(app.getAppPath(), 'resources', 'optifine-bridge')
    if (!existsSync(join(bridge, 'amcl', 'OptiFineInstall.class'))) {
      throw new Error('缺少 OptiFine 安装组件（resources/optifine-bridge）')
    }
    const javaPath = await this.resolveInstallerJava(gameVersion, task)
    await this.ensureLauncherProfiles(paths.gameRoot)
    task.update({
      stage: '运行 OptiFine 安装器',
      message: '正在释放补丁与依赖…',
      current: 0,
      total: 0,
      percent: undefined
    })
    const classpath = `${installerPath};${bridge}`
    await this.runJavaInstaller(
      javaPath,
      ['-Duser.language=en', '-cp', classpath, 'amcl.OptiFineInstall', paths.gameRoot],
      paths.gameRoot,
      task
    )
    const versionId = await this.findLatestInstalled(gameVersion, (id) =>
      id.toLowerCase().includes('optifine')
    )
    if (!versionId) throw new Error('OptiFine 安装结束，但没有找到生成的版本配置')
    versionService.invalidate()
    task.log(`OptiFine 版本已创建：${versionId}`)
    return versionId
  }

  private async resolveInstallerJava(gameVersion: string, task: TaskHandle): Promise<string> {
    const detail = await versionService.resolve(gameVersion)
    const required = detail.javaVersion?.majorVersion || guessJavaMajor(gameVersion)
    let runtime = await javaService.findFor(required, store.settings.javaPath)
    if (!runtime) {
      if (!store.settings.autoJava) {
        throw new Error(`安装加载器需要 Java ${required} 或更高版本`)
      }
      task.log(`未找到合适的 Java，正在下载 Java ${required}…`)
      runtime = await javaService.download(required)
    }
    task.log(`安装器使用 Java ${runtime.version}`)
    return runtime.path
  }

  private async ensureLauncherProfiles(gameRoot: string): Promise<void> {
    const file = join(gameRoot, 'launcher_profiles.json')
    if (existsSync(file)) return
    await writeFile(
      file,
      JSON.stringify({ profiles: {}, settings: {}, version: 3 }, null, 2),
      'utf8'
    )
  }

  private async runJavaInstaller(
    javaPath: string,
    args: string[],
    cwd: string,
    task: TaskHandle
  ): Promise<string> {
    return await new Promise<string>((resolve, reject) => {
      task.update({ stage: '安装加载器', message: '正在运行安装器…', percent: undefined })
      const child = spawn(javaPath, args, {
        cwd,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, JAVA_TOOL_OPTIONS: '' }
      })
      let output = ''
      let lastLog = 0
      const onData = (chunk: Buffer): void => {
        const text = chunk.toString('utf8')
        output += text
        const lines = text.split(/\r?\n/).filter((line) => line.trim())
        for (const line of lines) {
          if (
            /success|error|fail|exception|install|download|patch|optifine|forge/i.test(line) ||
            Date.now() - lastLog > 2000
          ) {
            task.log(line.slice(0, 300))
            lastLog = Date.now()
          }
        }
        task.update({ message: lines[lines.length - 1]?.slice(0, 160) || '安装中…' }, true)
      }
      child.stdout?.on('data', onData)
      child.stderr?.on('data', onData)
      const onAbort = (): void => {
        try {
          child.kill()
        } catch {
          // Ignore.
        }
      }
      task.signal.addEventListener('abort', onAbort, { once: true })
      const timer = setTimeout(() => {
        try {
          child.kill()
        } catch {
          // Ignore.
        }
        reject(new Error('安装器运行超时'))
      }, 15 * 60_000)
      child.on('error', (error) => {
        clearTimeout(timer)
        task.signal.removeEventListener('abort', onAbort)
        reject(error)
      })
      child.on('close', (code) => {
        clearTimeout(timer)
        task.signal.removeEventListener('abort', onAbort)
        if (code === 0) resolve(output)
        else reject(new Error(`安装器退出代码 ${code ?? '未知'}，请查看任务日志`))
      })
    })
  }

  private async findLatestInstalled(
    gameVersion: string,
    matcher: (id: string) => boolean
  ): Promise<string | null> {
    const paths = resolvePaths(store.settings)
    const entries = await readdir(paths.versionsDir, { withFileTypes: true }).catch(() => [])
    let best: { id: string; mtime: number } | null = null
    for (const entry of entries) {
      if (!entry.isDirectory() || !matcher(entry.name)) continue
      const jsonFile = join(paths.versionsDir, entry.name, `${entry.name}.json`)
      try {
        const detail = JSON.parse(await readFile(jsonFile, 'utf8')) as VersionJson
        if (detail.inheritsFrom !== gameVersion) continue
        const info = await stat(jsonFile)
        if (!best || info.mtimeMs > best.mtime) best = { id: entry.name, mtime: info.mtimeMs }
      } catch {
        // Ignore incomplete directories.
      }
    }
    return best?.id || null
  }

  private failTask(task: TaskHandle, error: unknown): void {
    if (task.signal.aborted || isAbortError(error)) {
      task.cancelled()
      logger.info(`任务已取消：${task.title}`)
    } else {
      task.fail(error)
      logger.error(`任务失败：${task.title} · ${String(error)}`)
    }
  }
}

export const installerService = new InstallerService()
