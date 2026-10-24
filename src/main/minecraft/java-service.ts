import AdmZip from 'adm-zip'
import { spawn } from 'node:child_process'
import { closeSync, existsSync, openSync } from 'node:fs'
import { mkdir, readFile, readdir, rm, stat, unlink, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { JavaRuntime } from '../../shared/types'
import { downloadFile, getJson } from '../http'
import { resolvePaths } from '../paths'
import { store } from '../store'
import { taskManager } from '../tasks'
import { logger } from '../logger'

interface AdoptiumAsset {
  binary?: {
    package?: {
      link?: string
      name?: string
      size?: number
      checksum?: string
    }
    version?: { semver?: string; major?: number }
  }
  release_name?: string
  version?: { semver?: string; major?: number }
}

async function runCapture(
  executable: string,
  args: string[],
  timeoutMs = 15_000
): Promise<{ code: number | null; output: string }> {
  const temp = join(tmpdir(), `amcl-java-${randomUUID()}.log`)
  const fd = openSync(temp, 'w')
  try {
    const code = await new Promise<number | null>((resolve, reject) => {
      const child = spawn(executable, args, {
        stdio: ['ignore', fd, fd],
        windowsHide: true
      })
      const timer = setTimeout(() => {
        try {
          child.kill()
        } catch {
          // Ignore.
        }
        reject(new Error('Java 检测超时'))
      }, timeoutMs)
      child.on('error', (error) => {
        clearTimeout(timer)
        reject(error)
      })
      child.on('close', (exitCode) => {
        clearTimeout(timer)
        resolve(exitCode)
      })
    })
    const output = await readFile(temp, 'utf8').catch(() => '')
    return { code, output }
  } finally {
    closeSync(fd)
    await unlink(temp).catch(() => undefined)
  }
}

export class JavaService {
  private cache: JavaRuntime[] | null = null
  private cacheAt = 0
  private inspecting = new Map<string, Promise<JavaRuntime | null>>()

  invalidate(): void {
    this.cache = null
    this.cacheAt = 0
  }

  async inspect(
    path: string,
    source: JavaRuntime['source'] = 'detected',
    managed = false
  ): Promise<JavaRuntime | null> {
    if (!path || !existsSync(path)) return null
    const key = path.toLowerCase()
    const existing = this.inspecting.get(key)
    if (existing) return existing
    const promise = (async (): Promise<JavaRuntime | null> => {
      try {
        const { output } = await runCapture(path, ['-XshowSettings:properties', '-version'])
        const version = /java\.version\s*=\s*([^\r\n]+)/.exec(output)?.[1]?.trim() || ''
        const vendor = /java\.vendor\s*=\s*([^\r\n]+)/.exec(output)?.[1]?.trim() || ''
        const arch = /os\.arch\s*=\s*([^\r\n]+)/.exec(output)?.[1]?.trim() || ''
        const home = /java\.home\s*=\s*([^\r\n]+)/.exec(output)?.[1]?.trim() || ''
        if (!version) return null
        const major = version.startsWith('1.') ? Number(version.split('.')[1]) : Number(version.split('.')[0])
        return {
          path: existsSync(join(home, 'bin', 'java.exe')) ? join(home, 'bin', 'java.exe') : path,
          major: Number.isFinite(major) ? major : 8,
          version,
          vendor,
          arch,
          source,
          managed
        }
      } catch (error) {
        logger.debug(`Java 检测失败 ${path}: ${String(error)}`)
        return null
      }
    })()
    this.inspecting.set(key, promise)
    try {
      return await promise
    } finally {
      this.inspecting.delete(key)
    }
  }

  private async collectCandidatePaths(): Promise<string[]> {
    const candidates = new Set<string>()
    const add = (path: string | undefined): void => {
      if (!path) return
      if (path.toLowerCase().endsWith('java.exe') && existsSync(path)) candidates.add(path)
    }

    add(store.settings.javaPath)
    if (process.env.JAVA_HOME) add(join(process.env.JAVA_HOME, 'bin', 'java.exe'))
    for (const dir of (process.env.PATH || '').split(';')) {
      if (dir) add(join(dir, 'java.exe'))
    }

    const paths = resolvePaths(store.settings)
    const roots = [
      paths.runtimeDir,
      join(process.env.ProgramFiles || 'C:\\Program Files', 'Java'),
      join(process.env.ProgramFiles || 'C:\\Program Files', 'Eclipse Adoptium'),
      join(process.env.ProgramFiles || 'C:\\Program Files', 'Microsoft'),
      join(process.env.ProgramFiles || 'C:\\Program Files', 'Zulu'),
      join(process.env.ProgramFiles || 'C:\\Program Files', 'Amazon Corretto'),
      join(process.env.ProgramFiles || 'C:\\Program Files', 'BellSoft'),
      join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Java'),
      join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'Programs', 'Eclipse Adoptium'),
      join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), '.minecraft', 'runtime')
    ]

    const walk = async (dir: string, depth: number): Promise<void> => {
      if (depth > 4 || candidates.size > 40) return
      const direct = join(dir, 'bin', 'java.exe')
      if (existsSync(direct)) {
        candidates.add(direct)
        return
      }
      const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        if (['cache', 'logs', 'assets', 'libraries', 'versions'].includes(entry.name)) continue
        await walk(join(dir, entry.name), depth + 1)
      }
    }
    for (const root of roots) {
      if (root && existsSync(root)) await walk(root, 0)
    }
    return [...candidates]
  }

  async detect(force = false): Promise<JavaRuntime[]> {
    if (!force && this.cache && Date.now() - this.cacheAt < 60_000) return this.cache
    const paths = await this.collectCandidatePaths()
    const results: JavaRuntime[] = []
    const seen = new Set<string>()
    for (const path of paths) {
      const source = path.toLowerCase().includes('runtime') ? 'bundled' : path === store.settings.javaPath ? 'custom' : 'detected'
      const runtime = await this.inspect(path, source, path.toLowerCase().includes('runtime'))
      if (runtime && !seen.has(runtime.path.toLowerCase())) {
        seen.add(runtime.path.toLowerCase())
        results.push(runtime)
      }
    }
    this.cache = results.sort((a, b) => b.major - a.major || a.path.localeCompare(b.path))
    this.cacheAt = Date.now()
    return this.cache
  }

  async findFor(requiredMajor: number, preferPath?: string): Promise<JavaRuntime | null> {
    if (preferPath && existsSync(preferPath)) {
      const custom = await this.inspect(preferPath, 'custom')
      if (custom && custom.major >= requiredMajor) return custom
    }
    const runtimes = await this.detect()
    const exact = runtimes.find((runtime) => runtime.major === requiredMajor)
    if (exact) return exact
    const higher = runtimes
      .filter((runtime) => runtime.major > requiredMajor)
      .sort((a, b) => a.major - b.major)
    if (higher.length) return higher[0]
    return null
  }

  async download(major: number): Promise<JavaRuntime> {
    const task = taskManager.create('java', `下载 Java ${major} 运行环境`)
    try {
      task.update({ stage: '查询运行时', message: 'Eclipse Temurin JRE' })
      const assets = await getJson<AdoptiumAsset[]>(
        `https://api.adoptium.net/v3/assets/latest/${major}/hotspot?architecture=x64&image_type=jre&os=windows&vendor=eclipse`,
        { timeoutMs: 30000, retries: 2 }
      )
      if (!Array.isArray(assets) || !assets.length) throw new Error(`没有找到 Java ${major} 的 Windows 运行时`)
      const pkg = assets[0].binary?.package
      if (!pkg?.link) throw new Error('Java 下载地址无效')
      const name = pkg.name || `temurin-${major}.zip`
      const cacheFile = join(resolvePaths(store.settings).cacheDir, 'java', name)
      let lastBytes = 0
      let lastTime = Date.now()
      let speed = 0
      await downloadFile(pkg.link, cacheFile, {
        signal: task.signal,
        size: pkg.size,
        verifyHash: false,
        timeoutMs: 60_000,
        onProgress: (received, total) => {
          const now = Date.now()
          if (now - lastTime > 300) {
            speed = ((received - lastBytes) / 1024 / 1024) / ((now - lastTime) / 1000)
            lastBytes = received
            lastTime = now
          }
          task.update({
            percent: total ? (received / total) * 100 : undefined,
            bytes: received,
            totalBytes: total,
            speed: Math.max(0, speed),
            message: `${(received / 1024 / 1024).toFixed(1)} MB`
          })
        }
      })

      task.update({ stage: '解压运行时', message: name, percent: undefined })
      const extractRoot = join(resolvePaths(store.settings).runtimeDir, `temurin-${major}`)
      await rm(extractRoot, { recursive: true, force: true })
      await mkdir(extractRoot, { recursive: true })
      const zip = new AdmZip(cacheFile)
      zip.extractAllTo(extractRoot, true)
      task.log('运行时解压完成')
      const javaPath = await this.findJavaExe(extractRoot)
      if (!javaPath) throw new Error('运行时中未找到 java.exe')
      const runtime = await this.inspect(javaPath, 'downloaded', true)
      if (!runtime) throw new Error('下载的 Java 运行时无法启动')
      this.cache = null
      task.success(`Java ${runtime.major} 已就绪`)
      return runtime
    } catch (error) {
      if (task.signal.aborted) task.cancelled()
      else task.fail(error)
      throw error
    }
  }

  private async findJavaExe(root: string): Promise<string | null> {
    const direct = join(root, 'bin', 'java.exe')
    if (existsSync(direct)) return direct
    const entries = await readdir(root, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const found = await this.findJavaExe(join(root, entry.name))
      if (found) return found
    }
    return null
  }
}

export const javaService = new JavaService()
