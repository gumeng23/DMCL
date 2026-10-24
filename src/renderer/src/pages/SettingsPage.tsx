import { useEffect, useMemo, useState } from 'react'
import {
  Check,
  ChevronRight,
  Coffee,
  Cpu,
  Download,
  FolderOpen,
  Gamepad2,
  Gauge,
  Globe2,
  HardDrive,
  Info,
  Moon,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Sun,
  Terminal,
  Wifi
} from 'lucide-react'
import type { Settings, SystemInfo } from '@shared/types'
import { useApp } from '@renderer/state/AppContext'
import { api, errorMessage } from '@renderer/lib/native'
import { formatBytes, loaderLabel } from '@renderer/lib/format'
import { Badge, Segmented, Spinner, Switch } from '@renderer/components/Ui'

function SettingSection({
  icon: Icon,
  title,
  description,
  children
}: {
  icon: typeof Gamepad2
  title: string
  description: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <section className="settings-section">
      <div className="settings-section-head">
        <span className="settings-section-icon">
          <Icon size={18} />
        </span>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      <div className="settings-rows">{children}</div>
    </section>
  )
}

function SettingRow({
  title,
  description,
  children,
  vertical = false
}: {
  title: string
  description?: string
  children: React.ReactNode
  vertical?: boolean
}): JSX.Element {
  return (
    <div className={`setting-row ${vertical ? 'vertical' : ''}`}>
      <div className="setting-label">
        <strong>{title}</strong>
        {description && <span>{description}</span>}
      </div>
      <div className="setting-control">{children}</div>
    </div>
  )
}

export function SettingsPage(): JSX.Element {
  const { data, selectedInstance, updateSettings, toast, refreshAll } = useApp()
  const [draft, setDraft] = useState<Settings>(data.settings)
  const [saving, setSaving] = useState(false)
  const [detectingJava, setDetectingJava] = useState(false)
  const [downloadingJava, setDownloadingJava] = useState(false)
  const [system, setSystem] = useState<SystemInfo | null>(null)
  const javaRuntimes = data.javaRuntimes
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(data.settings), [draft, data.settings])

  useEffect(() => {
    setDraft(data.settings)
  }, [data.settings])

  useEffect(() => {
    void api.systemInfo().then(setSystem).catch(() => undefined)
  }, [])

  const set = <K extends keyof Settings>(key: K, value: Settings[K]): void => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const save = async (): Promise<void> => {
    setSaving(true)
    try {
      const settings = await updateSettings(draft)
      setDraft(settings)
      toast('success', '设置已保存', '新的配置将在下次启动时生效')
    } catch (error) {
      toast('error', '保存失败', errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const pickDirectory = async (): Promise<void> => {
    const path = await api.settings.pickDirectory(draft.gameRoot)
    if (path) set('gameRoot', path)
  }

  const pickJava = async (): Promise<void> => {
    const path = await api.settings.pickFile('java')
    if (path) {
      set('javaPath', path)
      set('autoJava', false)
    }
  }

  const detectJava = async (): Promise<void> => {
    setDetectingJava(true)
    try {
      const runtimes = await api.java.detect(true)
      await refreshAll()
      toast('success', 'Java 检测完成', `找到 ${runtimes.length} 个可用运行时`)
    } catch (error) {
      toast('error', 'Java 检测失败', errorMessage(error))
    } finally {
      setDetectingJava(false)
    }
  }

  const downloadJava = async (): Promise<void> => {
    setDownloadingJava(true)
    try {
      const runtime = await api.java.download(21)
      await refreshAll()
      toast('success', 'Java 安装完成', `Java ${runtime.major} · ${runtime.vendor}`)
    } catch (error) {
      toast('error', 'Java 下载失败', errorMessage(error))
    } finally {
      setDownloadingJava(false)
    }
  }

  const javaOptions = [...javaRuntimes]
  if (draft.javaPath && !javaOptions.some((runtime) => runtime.path.toLowerCase() === draft.javaPath.toLowerCase())) {
    javaOptions.unshift({
      path: draft.javaPath,
      major: 0,
      version: '自定义路径',
      vendor: '自定义',
      arch: '',
      source: 'custom',
      managed: false
    })
  }

  return (
    <div className="page settings-page">
      <div className="page-heading settings-heading">
        <div>
          <div className="eyebrow-line">
            <span className="eyebrow-dot" />
            PREFERENCES
          </div>
          <h1>设置</h1>
          <p>调整启动器行为、Java 运行时与游戏性能。所有更改都会保存在本机。</p>
        </div>
        <div className="page-heading-actions">
          {dirty && <span className="unsaved-mark"><span /> 有未保存的更改</span>}
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!dirty}
            onClick={() => setDraft(data.settings)}
          >
            <RotateCcw size={14} />
            还原
          </button>
          <button type="button" className="btn btn-primary" disabled={!dirty || saving} onClick={() => void save()}>
            {saving ? <Spinner size={14} /> : <Save size={14} />}
            保存设置
          </button>
        </div>
      </div>

      <div className="settings-layout">
        <div className="settings-main">
          <SettingSection
            icon={Sun}
            title="外观与字体"
            description="启动器界面主题会立即应用到全部页面"
          >
            <SettingRow title="界面主题" description="亮色适合白天，暗色更护眼；保存后应用">
              <div className="theme-mode-options">
                <button
                  type="button"
                  className={`theme-mode-card theme-mode-dark ${draft.theme === 'dark' ? 'active' : ''}`}
                  onClick={() => set('theme', 'dark')}
                >
                  <span className="theme-mode-preview">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span className="theme-mode-name">
                    <Moon size={14} />
                    深色
                  </span>
                  {draft.theme === 'dark' && (
                    <span className="theme-mode-check">
                      <Check size={11} />
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  className={`theme-mode-card theme-mode-light ${draft.theme === 'light' ? 'active' : ''}`}
                  onClick={() => set('theme', 'light')}
                >
                  <span className="theme-mode-preview">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span className="theme-mode-name">
                    <Sun size={14} />
                    亮色
                  </span>
                  {draft.theme === 'light' && (
                    <span className="theme-mode-check">
                      <Check size={11} />
                    </span>
                  )}
                </button>
              </div>
            </SettingRow>
            <SettingRow title="界面字号" description="已为高分屏优化，标题、按钮与说明文字均已加大">
              <Badge tone="green">舒适阅读</Badge>
            </SettingRow>
          </SettingSection>

          <SettingSection
            icon={Gamepad2}
            title="游戏与目录"
            description="版本文件与每个实例的游戏数据彼此独立"
          >
            <SettingRow
              title="游戏目录"
              description="默认位于启动器安装目录下的 minecraft 文件夹，可随时更改"
              vertical
            >
              <div className="path-input-group">
                <div className="text-input path-input">
                  <HardDrive size={15} />
                  <input
                    value={draft.gameRoot}
                    onChange={(event) => set('gameRoot', event.target.value)}
                    spellCheck={false}
                  />
                </div>
                <button type="button" className="btn btn-ghost" onClick={() => void pickDirectory()}>
                  <FolderOpen size={14} />
                  浏览
                </button>
                <button
                  type="button"
                  className="icon-button"
                  title="打开目录"
                  onClick={() => void api.shell.openPath(draft.gameRoot)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </SettingRow>
            <SettingRow title="快速打开" description="查看当前实例与运行数据">
              <div className="inline-button-row">
                <button type="button" className="btn btn-ghost btn-small" onClick={() => void api.instances.openFolder(data.selectedInstanceId)}>
                  <FolderOpen size={13} /> 实例目录
                </button>
                <button type="button" className="btn btn-ghost btn-small" onClick={() => void api.java.openFolder()}>
                  <Coffee size={13} /> 运行时目录
                </button>
                <button type="button" className="btn btn-ghost btn-small" onClick={() => void api.shell.openPath(data.paths.logsDir)}>
                  <Terminal size={13} /> 日志目录
                </button>
              </div>
            </SettingRow>
            <SettingRow title="游戏分辨率" description="窗口模式下使用的默认画面尺寸">
              <div className="resolution-editor">
                <input
                  type="number"
                  value={draft.resolutionWidth}
                  min={640}
                  max={7680}
                  onChange={(event) => set('resolutionWidth', Number(event.target.value))}
                />
                <span>×</span>
                <input
                  type="number"
                  value={draft.resolutionHeight}
                  min={480}
                  max={4320}
                  onChange={(event) => set('resolutionHeight', Number(event.target.value))}
                />
                <Badge tone="neutral">窗口</Badge>
              </div>
            </SettingRow>
            <SettingRow title="全屏启动" description="直接以全屏模式进入游戏">
              <Switch checked={draft.fullscreen} onChange={(value) => set('fullscreen', value)} />
            </SettingRow>
            <SettingRow title="游戏默认语言" description="仅在 options.txt 尚未设置语言时写入">
              <select
                className="select-input"
                value={draft.gameLanguage}
                onChange={(event) => set('gameLanguage', event.target.value)}
              >
                <option value="zh_cn">简体中文</option>
                <option value="zh_tw">繁體中文</option>
                <option value="en_us">English</option>
              </select>
            </SettingRow>
            <SettingRow title="跳过首次辅助功能引导" description="取消进入游戏前的辅助功能选择界面">
              <Switch
                checked={draft.skipAccessibility}
                onChange={(value) => set('skipAccessibility', value)}
              />
            </SettingRow>
            <SettingRow title="跳过多人游戏警告" description="直接进入主菜单，不再弹出多人游戏提示">
              <Switch
                checked={draft.skipMultiplayerWarning}
                onChange={(value) => set('skipMultiplayerWarning', value)}
              />
            </SettingRow>
          </SettingSection>

          <SettingSection
            icon={Coffee}
            title="Java 与性能"
            description="启动器会自动选择满足版本要求的 Java 运行时"
          >
            <SettingRow title="自动管理 Java" description="找不到合适运行时时自动下载 Eclipse Temurin">
              <Switch checked={draft.autoJava} onChange={(value) => set('autoJava', value)} />
            </SettingRow>
            <SettingRow title="Java 可执行文件" description="留空则使用自动检测结果" vertical>
              <div className="java-picker">
                <select
                  value={draft.javaPath}
                  onChange={(event) => set('javaPath', event.target.value)}
                >
                  <option value="">自动选择（推荐）</option>
                  {javaOptions.map((runtime) => (
                    <option key={runtime.path} value={runtime.path}>
                      {runtime.major ? `Java ${runtime.major}` : '自定义'} · {runtime.vendor} · {runtime.path}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn btn-ghost" onClick={() => void detectJava()} disabled={detectingJava}>
                  {detectingJava ? <Spinner size={14} /> : <Cpu size={14} />}
                  重新检测
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => void pickJava()}>
                  <FolderOpen size={14} />
                  选择
                </button>
              </div>
              <div className="java-hints">
                <span>{javaRuntimes.length} 个运行时已检测</span>
                <i />
                <span>推荐 Java 21</span>
                <button type="button" onClick={() => void downloadJava()} disabled={downloadingJava}>
                  {downloadingJava ? <Spinner size={12} /> : <Download size={12} />}
                  下载 Java 21
                </button>
              </div>
            </SettingRow>
            <SettingRow title="最大内存" description="为游戏分配的最大堆内存，过高可能影响系统稳定性">
              <div className="slider-group">
                <input
                  type="range"
                  min={1024}
                  max={16384}
                  step={512}
                  value={draft.memoryMb}
                  onChange={(event) => set('memoryMb', Number(event.target.value))}
                  style={{ '--fill': `${((draft.memoryMb - 1024) / (16384 - 1024)) * 100}%` } as React.CSSProperties}
                />
                <span className="slider-value">{(draft.memoryMb / 1024).toFixed(1)} GB</span>
              </div>
            </SettingRow>
            <SettingRow title="额外 JVM 参数" description="高级用户可添加自定义参数，多个参数用空格分隔" vertical>
              <div className="text-input mono-input">
                <SlidersHorizontal size={15} />
                <input
                  value={draft.jvmArgs}
                  onChange={(event) => set('jvmArgs', event.target.value)}
                  placeholder="-XX:+UseG1GC -Dfile.encoding=UTF-8"
                  spellCheck={false}
                />
              </div>
            </SettingRow>
          </SettingSection>

          <SettingSection
            icon={Globe2}
            title="下载与网络"
            description="选择资源下载来源，AMCL 会在失败时自动回退"
          >
            <SettingRow title="下载源" description="国内网络推荐使用 BMCLAPI 镜像">
              <Segmented
                value={draft.downloadSource}
                onChange={(value) => set('downloadSource', value)}
                options={[
                  { value: 'auto', label: '智能' },
                  { value: 'official', label: '官方' },
                  { value: 'bmclapi', label: 'BMCLAPI' }
                ]}
              />
            </SettingRow>
            <SettingRow title="并行下载数" description="越多的连接数不等于越快，取决于网络环境">
              <div className="slider-group compact">
                <input
                  type="range"
                  min={1}
                  max={32}
                  step={1}
                  value={draft.downloadThreads}
                  onChange={(event) => set('downloadThreads', Number(event.target.value))}
                  style={{ '--fill': `${((draft.downloadThreads - 1) / 31) * 100}%` } as React.CSSProperties}
                />
                <span className="slider-value">{draft.downloadThreads}</span>
              </div>
            </SettingRow>
            <SettingRow title="校验已有文件" description="重新安装时计算 SHA1，更安全但会变慢">
              <Switch checked={draft.checkGameFiles} onChange={(value) => set('checkGameFiles', value)} />
            </SettingRow>
            <SettingRow title="显示快照版本" description="在版本库中显示快照和远古版本">
              <Switch checked={draft.showSnapshots} onChange={(value) => set('showSnapshots', value)} />
            </SettingRow>
          </SettingSection>

          <SettingSection
            icon={Gauge}
            title="启动行为"
            description="游戏启动后启动器如何响应"
          >
            <SettingRow title="启动后隐藏启动器" description="游戏运行期间保持后台常驻">
              <Switch checked={draft.closeAfterLaunch} onChange={(value) => set('closeAfterLaunch', value)} />
            </SettingRow>
            <SettingRow title="启动后最小化" description="保留任务栏图标，便于快速返回">
              <Switch checked={draft.minimizeOnLaunch} onChange={(value) => set('minimizeOnLaunch', value)} />
            </SettingRow>
            <SettingRow title="离线模式" description="仅在无法连接网络时使用缓存的版本信息">
              <span className={`status-text ${data.online ? 'good' : 'warn'}`}>
                <span />
                {data.online ? '已连接认证与资源服务' : '离线模式已启用'}
              </span>
            </SettingRow>
          </SettingSection>
        </div>

        <aside className="settings-aside">
          <section className="settings-summary">
            <div className="summary-orbit">
              <div className="summary-cube">
                <span />
              </div>
            </div>
            <span className="section-kicker">CURRENT PROFILE</span>
            <h3>{selectedInstance?.name}</h3>
            <p>{selectedInstance?.versionId || '未选择版本'}</p>
            <div className="summary-rows">
              <div>
                <span>加载器</span>
                <strong>{loaderLabel[selectedInstance?.loader || 'vanilla']}</strong>
              </div>
              <div>
                <span>最大内存</span>
                <strong>{(draft.memoryMb / 1024).toFixed(1)} GB</strong>
              </div>
              <div>
                <span>Java</span>
                <strong>{draft.javaPath ? '自定义' : '自动选择'}</strong>
              </div>
              <div>
                <span>下载源</span>
                <strong>{draft.downloadSource === 'auto' ? '智能' : draft.downloadSource === 'official' ? '官方' : 'BMCLAPI'}</strong>
              </div>
            </div>
          </section>

          <section className="about-card">
            <div className="about-head">
              <span className="about-logo">A</span>
              <div>
                <strong>AMCL Launcher</strong>
                <span>Version {data.appVersion}</span>
              </div>
              <Badge tone="green">稳定版</Badge>
            </div>
            <div className="about-meta">
              <div>
                <span>Electron</span>
                <strong>{system?.electron || '—'}</strong>
              </div>
              <div>
                <span>Chromium</span>
                <strong>{system?.chrome || '—'}</strong>
              </div>
              <div>
                <span>系统内存</span>
                <strong>{system ? formatBytes(system.totalMemory) : '—'}</strong>
              </div>
              <div>
                <span>系统架构</span>
                <strong>{system?.arch || '—'}</strong>
              </div>
            </div>
            <div className="about-links">
              <button type="button" onClick={() => void api.shell.openExternal('https://www.minecraft.net/zh-hans')}>
                <Globe2 size={14} />
                Minecraft 官网
              </button>
              <button type="button" onClick={() => void api.shell.openPath(data.paths.logsDir)}>
                <Info size={14} />
                打开日志
              </button>
            </div>
          </section>

          <div className="settings-note">
            <Wifi size={15} />
            <p>
              AMCL 不会上传你的游戏数据。账户凭据仅保存在本机，并使用系统级加密保护。
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
