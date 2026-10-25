import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createWriteStream } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { LaunchLog, LaunchState, Instance } from '../../shared/types'
import { resolvePaths } from '../paths'
import { store } from '../store'
import { logger } from '../logger'
import { appEvents } from '../events'
import { currentRuleContext, expandArguments, rulesAllow, splitCommandLine } from './rules'
import type { ResolvedVersion, VersionLibrary } from './types'
import { versionService } from './version-service'
import { javaService } from './java-service'
import { microsoftAuth } from '../auth/microsoft'

interface RunningGame {
  child: ChildProcess
  state: LaunchState
  logStream: ReturnType<typeof createWriteStream>
}

function requiredJavaMajor(detail: ResolvedVersion): number {
  if (detail.javaVersion?.majorVersion) return detail.javaVersion.majorVersion
  const version = detail.jar
  if (/^1\.(20\.(5|6)|21)/.test(version)) return 21
  if (/^1\.(18|19|20)/.test(version)) return 17
  if (version === '1.17' || version.startsWith('1.17.')) return 16
  return 8
}

function mavenToPath(name: string): string {
  const [coordinates, extension = 'jar'] = name.split('@')
  const [group, artifact, version, classifier] = coordinates.split(':')
  if (!group || !artifact || !version) return ''
  const fileName = `${artifact}-${version}${classifier ? `-${classifier}` : ''}.${extension}`
  return `${group.replace(/\./g, '/')}/${artifact}/${version}/${fileName}`
}

function libraryClassPath(library: VersionLibrary): string {
  return library.downloads?.artifact?.path || mavenToPath(library.name)
}

function replaceTokens(input: string, values: Record<string, string>): string {
  return input.replace(/\$\{([^}]+)\}/g, (match, key: string) => values[key] ?? match)
}

export class LaunchService {
  private running = new Map<string, RunningGame>()
  private states = new Map<string, LaunchState>()

  getStates(): LaunchState[] {
    return [...this.states.values()]
  }

  isRunning(instanceId: string): boolean {
    return this.running.has(instanceId)
  }

  async launch(instanceId: string): Promise<{ pid: number }> {
    if (this.running.has(instanceId)) throw new Error('这个实例已经在运行中')
    const instance = store.instances.find((item) => item.id === instanceId)
    if (!instance) throw new Error('实例不存在')
    if (!instance.versionId) throw new Error('请先为此实例安装一个游戏版本')
    if (!(await versionService.isInstalled(instance.versionId))) {
      throw new Error(`版本 ${instance.versionId} 尚未安装`)
    }

    let account = store.selectedAccount
    if (!account) throw new Error('请先添加一个账户')
    if (account.kind === 'microsoft') {
      account = await microsoftAuth.ensureFresh(account.id)
    }

    const detail = await versionService.resolve(instance.versionId)
    const paths = resolvePaths(store.settings)
    const requiredJava = requiredJavaMajor(detail)
    const javaPathOverride = instance.javaPath || store.settings.javaPath
    let javaRuntime = await javaService.findFor(requiredJava, javaPathOverride)
    if (!javaRuntime || javaRuntime.major < requiredJava) {
      if (!store.settings.autoJava) {
        throw new Error(`需要 Java ${requiredJava} 或更高版本，请在设置中指定 Java 路径`)
      }
      this.emitState({
        instanceId,
        status: 'preparing',
        message: `正在准备 Java ${requiredJava} 运行环境…`
      })
      javaRuntime = await javaService.download(requiredJava)
    }
    if (!javaRuntime) throw new Error('Java 运行时不可用')

    const gameDir = instance.gameDir
    await this.ensureGameDirectories(gameDir)
    await this.applyGameDefaults(gameDir)
    const classpathEntries: string[] = []
    const ruleContext = currentRuleContext({
      has_custom_resolution: !store.settings.fullscreen && store.settings.resolutionWidth > 0,
      is_demo_user: false,
      has_quick_plays_support: false
    })
    for (const library of detail.libraries) {
      if (!rulesAllow(library.rules, ruleContext)) continue
      const path = libraryClassPath(library)
      if (path) classpathEntries.push(join(paths.librariesDir, path))
    }
    const clientJar = join(paths.versionsDir, detail.jar, `${detail.jar}.jar`)
    if (existsSync(clientJar)) classpathEntries.push(clientJar)
    if (!classpathEntries.length) throw new Error('版本依赖不完整，请重新安装该版本')

    const assetIndexId = detail.assetIndex?.id || detail.assets
    const loggingFile = detail.logging?.client?.file
    const logConfig = loggingFile ? join(paths.assetsDir, 'log_configs', loggingFile.id) : ''
    const memory = Math.min(65536, Math.max(512, instance.memoryMb || store.settings.memoryMb))
    const minMemory = Math.min(memory, store.settings.minMemoryMb)
    const nativesDir = join(paths.versionsDir, detail.id, 'natives')
    if (!existsSync(nativesDir)) await mkdir(nativesDir, { recursive: true })

    const uuid = account.uuid.replace(/-/g, '')
    const accessToken = account.kind === 'offline' ? '0' : account.accessToken || '0'
    const userType = account.kind === 'offline' ? 'legacy' : account.kind === 'microsoft' ? 'msa' : 'mojang'
    const values: Record<string, string> = {
      auth_player_name: account.name,
      version_name: detail.id,
      game_directory: gameDir,
      assets_root: paths.assetsDir,
      game_assets: join(paths.assetsDir, 'virtual', assetIndexId || 'legacy'),
      assets_index_name: assetIndexId || 'legacy',
      auth_uuid: uuid,
      auth_access_token: accessToken,
      auth_session: accessToken,
      clientid: '',
      auth_xuid: account.xuid || '',
      user_type: userType,
      version_type: detail.type,
      resolution_width: String(store.settings.resolutionWidth),
      resolution_height: String(store.settings.resolutionHeight),
      natives_directory: nativesDir,
      library_directory: paths.librariesDir,
      classpath: classpathEntries.join(';'),
      classpath_separator: ';',
      launcher_name: 'DMCL',
      launcher_version: '1.0.0',
      user_properties: '{}'
    }

    let jvmArgs = expandArguments(detail.arguments.jvm, ruleContext).map((arg) => replaceTokens(arg, values))
    if (!jvmArgs.length) {
      jvmArgs = [
        `-Djava.library.path=${nativesDir}`,
        '-cp',
        classpathEntries.join(';')
      ]
    }
    if (logConfig && existsSync(logConfig) && !jvmArgs.some((arg) => arg.includes('log4j.configurationFile'))) {
      jvmArgs.push(`-Dlog4j.configurationFile=${logConfig}`)
    }
    jvmArgs.unshift(`-Xms${minMemory}M`, `-Xmx${memory}M`)
    jvmArgs.push(
      '-Dminecraft.launcher.brand=DMCL',
      '-Dminecraft.launcher.version=1.0.0',
      '-Dlog4j2.formatMsgNoLookups=true'
    )
    const customJvmArgs = (instance.jvmArgs || store.settings.jvmArgs || '').trim()
    if (customJvmArgs) jvmArgs.push(...splitCommandLine(customJvmArgs))

    let gameArgs = detail.arguments.game?.length
      ? expandArguments(detail.arguments.game, ruleContext).map((arg) => replaceTokens(arg, values))
      : splitCommandLine(detail.minecraftArguments || '').map((arg) => replaceTokens(arg, values))
    if (!gameArgs.some((arg) => arg === '--width') && !store.settings.fullscreen && store.settings.resolutionWidth) {
      gameArgs.push('--width', String(store.settings.resolutionWidth), '--height', String(store.settings.resolutionHeight))
    }
    if (store.settings.fullscreen) gameArgs.push('--fullscreen')

    if (account.kind === 'authlib' && account.authServer) {
      const injector = store.settings.authlibInjectorPath
      if (injector && existsSync(injector)) {
        jvmArgs.push(`-javaagent:${injector}=${account.authServer}`)
      } else {
        logger.warn('外置登录账户缺少 authlib-injector，游戏可能无法通过验证')
      }
    }

    const finalArgs = [...jvmArgs, detail.mainClass, ...gameArgs]
    this.emitState({
      instanceId,
      status: 'launching',
      message: '正在启动游戏…'
    })
    const logFile = join(paths.logsDir, `game-${instance.id}.log`)
    const logStream = createWriteStream(logFile, { flags: 'a' })
    logStream.write(`\n===== ${new Date().toISOString()} DMCL Launch =====\n`)
    logStream.write(`Instance: ${instance.name}\nVersion: ${detail.id}\nJava: ${javaRuntime.path}\n\n`)

    logger.info(`启动 ${instance.name} / ${detail.id} / Java ${javaRuntime.version}`)
    let child: ChildProcess
    try {
      child = spawn(javaRuntime.path, finalArgs, {
        cwd: gameDir,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          APPDATA: process.env.APPDATA,
          // Keep the official launcher's native paths available but let the game use this instance.
          JAVA_TOOL_OPTIONS: ''
        }
      })
    } catch (error) {
      logStream.end()
      this.emitState({
        instanceId,
        status: 'crashed',
        message: `无法启动 Java：${error instanceof Error ? error.message : String(error)}`
      })
      throw error
    }
    if (!child.pid) {
      logStream.end()
      this.emitState({
        instanceId,
        status: 'crashed',
        message: '无法启动 Java 进程，请检查 Java 路径'
      })
      throw new Error('无法启动 Java 进程')
    }
    const startedAt = Date.now()
    const state: LaunchState = {
      instanceId,
      status: 'running',
      pid: child.pid,
      startedAt,
      message: '游戏已启动'
    }
    this.states.set(instanceId, state)
    this.emitState(state)
    this.writeLog(instance.id, 'launcher', `游戏进程已启动 · PID ${child.pid}`)

    const entry: RunningGame = {
      child,
      state,
      logStream
    }
    this.running.set(instanceId, entry)

    const handleLine = (stream: 'stdout' | 'stderr', chunk: Buffer): void => {
      const text = chunk.toString('utf8')
      for (const line of text.split(/\r?\n/)) {
        if (!line.trim()) continue
        logStream.write(`[${stream}] ${line}\n`)
        this.writeLog(instance.id, stream, line)
      }
    }
    child.stdout?.on('data', (chunk: Buffer) => handleLine('stdout', chunk))
    child.stderr?.on('data', (chunk: Buffer) => handleLine('stderr', chunk))
    child.on('error', (error) => {
      logger.error(`游戏进程错误：${String(error)}`)
      this.writeLog(instance.id, 'launcher', `进程错误：${error.message}`)
    })
    child.on('close', (code) => {
      this.running.delete(instanceId)
      const endedAt = Date.now()
      const crashed = code !== 0
      const finalState: LaunchState = {
        ...state,
        status: crashed ? 'crashed' : 'exited',
        exitCode: code ?? -1,
        endedAt,
        message: crashed ? `游戏异常退出（代码 ${code ?? '未知'}）` : '游戏已正常退出'
      }
      this.states.set(instanceId, finalState)
      this.emitState(finalState)
      this.writeLog(instance.id, 'launcher', finalState.message || '')
      logStream.write(`\n[DMCL] ${finalState.message}\n`)
      logStream.end()
      void store.notePlaytime(instance.id, (endedAt - startedAt) / 1000)
    })

    return { pid: child.pid }
  }

  private async ensureGameDirectories(gameDir: string): Promise<void> {
    for (const dir of ['mods', 'resourcepacks', 'shaderpacks', 'saves', 'logs', 'config']) {
      await mkdir(join(gameDir, dir), { recursive: true })
    }
  }

  /**
   * Seed the first-launch options without overwriting settings the player already changed.
   * Chinese is the default UI language and the accessibility onboarding is suppressed.
   */
  private async applyGameDefaults(gameDir: string): Promise<void> {
    const file = join(gameDir, 'options.txt')
    let lines: string[] = []
    try {
      const raw = await readFile(file, 'utf8')
      lines = raw.split(/\r?\n/).filter((line) => line.length > 0)
    } catch {
      lines = []
    }
    const index = new Map<string, number>()
    lines.forEach((line, i) => {
      const key = line.split(':')[0]
      if (key) index.set(key, i)
    })
    const set = (key: string, value: string, force = false): void => {
      const line = `${key}:${value}`
      const existingIndex = index.get(key)
      if (existingIndex !== undefined) {
        if (force) lines[existingIndex] = line
      } else {
        index.set(key, lines.length)
        lines.push(line)
      }
    }
    if (!index.has('lang')) set('lang', store.settings.gameLanguage || 'zh_cn')
    if (store.settings.skipAccessibility) set('onboardAccessibility', 'false', true)
    if (store.settings.skipMultiplayerWarning) set('skipMultiplayerWarning', 'true', true)
    if (!index.has('tutorialStep')) set('tutorialStep', 'none')
    await mkdir(gameDir, { recursive: true })
    await writeFile(file, `${lines.join('\n')}\n`, 'utf8')
  }

  private writeLog(instanceId: string, stream: LaunchLog['stream'], line: string): void {
    appEvents.emit('launch:log', {
      instanceId,
      stream,
      line,
      time: Date.now()
    } satisfies LaunchLog)
  }

  private emitState(state: LaunchState): void {
    this.states.set(state.instanceId, state)
    appEvents.emit('launch:state', state)
  }

  async stop(instanceId: string): Promise<void> {
    const entry = this.running.get(instanceId)
    if (!entry?.child.pid) return
    this.writeLog(instanceId, 'launcher', '正在结束游戏进程…')
    await new Promise<void>((resolve) => {
      const killer = spawn('taskkill', ['/pid', String(entry.child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true
      })
      killer.on('close', () => resolve())
      killer.on('error', () => {
        try {
          entry.child.kill()
        } catch {
          // Ignore.
        }
        resolve()
      })
    })
  }

  async stopAll(): Promise<void> {
    for (const id of [...this.running.keys()]) await this.stop(id)
  }
}

export const launchService = new LaunchService()
export type { Instance }
