import {
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  Clock3,
  Coffee,
  Cpu,
  FolderOpen,
  Gauge,
  MapPin,
  MemoryStick,
  Play,
  Settings2,
  Sparkles,
  Square,
  Terminal,
  Wrench
} from 'lucide-react'
import { useApp } from '@renderer/state/AppContext'
import {
  accountKindLabel,
  formatPlaytime,
  loaderLabel,
  relativeTime,
  themeMeta,
  todayLabel
} from '@renderer/lib/format'
import { api } from '@renderer/lib/native'
import { AccountAvatar, Badge, Spinner } from '@renderer/components/Ui'
import { HeroScene } from '@renderer/components/HeroScene'

function greeting(name: string): string {
  const hour = new Date().getHours()
  const prefix = hour < 6 ? '夜深了' : hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好'
  return `${prefix}，${name}`
}

export function HomePage({ onAccount }: { onAccount: () => void }): JSX.Element {
  const {
    data,
    selectedInstance,
    selectedAccount,
    launchStates,
    logs,
    startGame,
    stopGame,
    launching,
    setPage,
    isRunning
  } = useApp()

  const instance = selectedInstance
  const installed = data.installedVersions.find((version) => version.id === instance?.versionId)
  const latest = data.latestRelease
  const activeState = launchStates[instance?.id || '']
  const displayVersion = instance?.versionId || latest?.id || '未选择版本'
  const java = data.javaRuntimes[0]
  const memory = instance?.memoryMb || data.settings.memoryMb
  const news = [...data.news].sort((a, b) => Number(b.java) - Number(a.java)).slice(0, 2)
  const recentLogs = logs.slice(-6)
  const theme = themeMeta[instance?.theme || 'grass']

  const launchLabel = isRunning
    ? '结束游戏'
    : launching || activeState?.status === 'preparing' || activeState?.status === 'launching'
      ? '正在启动'
      : installed
        ? '开始游戏'
        : displayVersion === '未选择版本'
          ? '安装一个版本'
          : '安装并开始'

  const handleLaunch = (): void => {
    if (isRunning) {
      void stopGame()
    } else if (!installed) {
      setPage('versions')
    } else {
      void startGame()
    }
  }

  return (
    <div className="page home-page">
      <div className="home-heading">
        <div>
          <div className="eyebrow-line">
            <span className="eyebrow-dot" />
            {todayLabel()}
            <span className="eyebrow-divider" />
            {data.online ? '所有服务运行正常' : '当前处于离线模式'}
          </div>
          <h1>{greeting(selectedAccount?.name || '冒险者')}</h1>
          <p>世界已经准备好，只等你按下开始。</p>
        </div>
        <div className="home-heading-side">
          {instance && (
            <div className="current-instance-chip">
              <span className="current-instance-cover" style={{ background: theme.gradient }}>
                <span />
              </span>
              <div>
                <span>正在使用</span>
                <strong>{instance.name}</strong>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="home-grid">
        <section className="hero-card">
          <HeroScene />
          <div className="hero-tint" />
          <div className="hero-top">
            <div className="hero-eyebrow">
              <span className="live-dot" />
              MINECRAFT · JAVA EDITION
            </div>
            <div className="hero-badges">
              <Badge tone="green">
                {instance?.loader ? loaderLabel[instance.loader] : '原版'} · {displayVersion}
              </Badge>
              {installed ? (
                <Badge tone="neutral">
                  <CheckCircle2 size={11} /> 已安装
                </Badge>
              ) : (
                <Badge tone="amber">等待安装</Badge>
              )}
            </div>
          </div>

          <div className="hero-content">
            <div className="hero-kicker">READY FOR A NEW ADVENTURE</div>
            <h2>
              去创造，
              <br />
              <span>属于你的世界。</span>
            </h2>
            <p className="hero-description">
              穿过晨雾与松林，在山海之间留下第一块方块。
              {installed ? '一切已就绪。' : '安装这个版本，开始新的旅程。'}
            </p>
            <div className="hero-actions">
              <button
                type="button"
                className={`launch-button ${isRunning ? 'is-running' : ''}`}
                onClick={handleLaunch}
                disabled={launching || activeState?.status === 'preparing'}
              >
                <span className="launch-button-icon">
                  {isRunning ? (
                    <Square size={18} fill="currentColor" />
                  ) : launching || activeState?.status === 'preparing' ? (
                    <Spinner size={18} />
                  ) : (
                    <Play size={19} fill="currentColor" />
                  )}
                </span>
                <span>{launchLabel}</span>
                {!isRunning && installed && <span className="launch-shortcut">Enter</span>}
              </button>
              <button
                type="button"
                className="hero-icon-button"
                title="打开游戏目录"
                onClick={() => void api.instances.openFolder(instance.id)}
              >
                <FolderOpen size={19} />
              </button>
            </div>
            <div className="hero-footnote">
              <span>
                <Cpu size={13} /> {java ? `Java ${java.major} · ${java.vendor || '已检测'}` : 'Java 未检测'}
              </span>
              <span>
                <MemoryStick size={13} /> {memory} MB 内存
              </span>
              <span>
                <Gauge size={13} /> {data.settings.fullscreen ? '全屏' : `${data.settings.resolutionWidth} × ${data.settings.resolutionHeight}`}
              </span>
            </div>
          </div>

          <div className="hero-instance-tag">
            <span className="hero-instance-charm" style={{ background: theme.gradient }}>
              <MapPin size={14} />
            </span>
            <div>
              <span>当前存档目录</span>
              <strong>{instance?.name || '默认实例'}</strong>
            </div>
          </div>
        </section>

        <aside className="home-side">
          <section className="profile-card">
            <div className="profile-card-head">
              <span>我的账户</span>
              <button type="button" onClick={onAccount}>
                管理
                <ArrowUpRight size={13} />
              </button>
            </div>
            <div className="profile-main">
              <AccountAvatar account={selectedAccount} size={54} className="profile-avatar" />
              <div className="profile-copy">
                <h3>{selectedAccount?.name || '未登录'}</h3>
                <span>{selectedAccount ? accountKindLabel[selectedAccount.kind] : '添加一个账户'}</span>
              </div>
              <span className="profile-status">
                <span />
                就绪
              </span>
            </div>
            <div className="profile-stats">
              <div>
                <span>累计游玩</span>
                <strong>{formatPlaytime(instance?.totalPlayTime || 0)}</strong>
              </div>
              <div>
                <span>上次启动</span>
                <strong>{relativeTime(instance?.lastPlayed || 0)}</strong>
              </div>
            </div>
            <button type="button" className="profile-action" onClick={onAccount}>
              <span className="profile-action-icon">
                <Sparkles size={15} />
              </span>
              切换或添加账户
              <ArrowUpRight size={14} />
            </button>
          </section>

          <section className="news-card">
            <div className="section-head">
              <div>
                <span className="section-kicker">LATEST</span>
                <h3>世界动态</h3>
              </div>
              <button
                type="button"
                className="text-button"
                onClick={() => void api.shell.openExternal('https://www.minecraft.net/zh-hans/news')}
              >
                全部
                <ArrowUpRight size={13} />
              </button>
            </div>
            <div className="news-list">
              {news.length === 0 ? (
                <div className="news-empty">
                  <Sparkles size={15} />
                  <span>暂时没有新的动态</span>
                </div>
              ) : (
                news.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className="news-item"
                    onClick={() => void api.shell.openExternal(item.url)}
                  >
                    <span
                      className="news-thumb"
                      style={
                        item.image
                          ? { backgroundImage: `linear-gradient(180deg, transparent, rgba(0,0,0,.35)), url("${item.image}")` }
                          : undefined
                      }
                    >
                      {!item.image && <Sparkles size={17} />}
                    </span>
                    <span className="news-copy">
                      <strong>{item.title}</strong>
                      <span>
                        {item.category}
                        <i>·</i>
                        {item.date}
                      </span>
                    </span>
                    <ArrowUpRight size={14} className="news-arrow" />
                  </button>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-icon green">
            <Boxes size={18} />
          </span>
          <div>
            <span>已安装版本</span>
            <strong>
              {data.installedVersions.length}
              <small>个</small>
            </strong>
          </div>
          <span className="stat-side">{data.latestRelease ? `最新 ${data.latestRelease.id}` : '离线'}</span>
        </div>
        <div className="stat-card">
          <span className="stat-icon blue">
            <Coffee size={18} />
          </span>
          <div>
            <span>Java 运行时</span>
            <strong>{java ? `Java ${java.major}` : '未就绪'}</strong>
          </div>
          <span className="stat-side">{java ? java.arch || 'x64' : '需要下载'}</span>
        </div>
        <div className="stat-card">
          <span className="stat-icon amber">
            <MemoryStick size={18} />
          </span>
          <div>
            <span>分配内存</span>
            <strong>
              {(memory / 1024).toFixed(memory % 1024 === 0 ? 0 : 1)}
              <small>GB</small>
            </strong>
          </div>
          <span className="stat-side">可在设置中调整</span>
        </div>
        <div className="stat-card">
          <span className="stat-icon violet">
            <Clock3 size={18} />
          </span>
          <div>
            <span>游戏时长</span>
            <strong>{Math.round((instance?.totalPlayTime || 0) / 60)}<small>分钟</small></strong>
          </div>
          <span className="stat-side">{relativeTime(instance?.lastPlayed || 0)}</span>
        </div>
      </div>

      <div className="home-bottom">
        <section className="console-card">
          <div className="section-head console-head">
            <div>
              <span className="section-kicker">CONSOLE</span>
              <h3>启动日志</h3>
            </div>
            <div className="console-head-actions">
              <span className={`console-led ${isRunning ? 'active' : ''}`} />
              <span>{isRunning ? '游戏运行中' : '等待启动'}</span>
              <button type="button" className="icon-text-button" onClick={() => void api.shell.openPath(data.paths.logsDir)}>
                <FolderOpen size={13} />
                日志
              </button>
            </div>
          </div>
          <div className="console-body">
            {recentLogs.length === 0 ? (
              <div className="console-empty">
                <Terminal size={16} />
                <span>启动游戏后，运行日志会实时出现在这里。</span>
              </div>
            ) : (
              recentLogs.map((log, index) => (
                <div className={`console-line ${log.stream}`} key={`${log.time}-${index}`}>
                  <span className="console-time">
                    {new Date(log.time).toLocaleTimeString('zh-CN', { hour12: false })}
                  </span>
                  <span className="console-stream">{log.stream === 'stderr' ? 'ERR' : log.stream === 'launcher' ? 'DMCL' : 'OUT'}</span>
                  <span className="console-text">{log.line}</span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="quick-card">
          <div className="section-head">
            <div>
              <span className="section-kicker">SHORTCUTS</span>
              <h3>快捷操作</h3>
            </div>
          </div>
          <div className="quick-grid">
            <button type="button" onClick={() => setPage('versions')}>
              <span className="quick-icon">
                <Boxes size={17} />
              </span>
              <span>
                <strong>浏览版本</strong>
                <small>安装与管理</small>
              </span>
              <ArrowUpRight size={14} />
            </button>
            <button type="button" onClick={() => void api.instances.openFolder(instance.id)}>
              <span className="quick-icon">
                <FolderOpen size={17} />
              </span>
              <span>
                <strong>游戏目录</strong>
                <small>模组与存档</small>
              </span>
              <ArrowUpRight size={14} />
            </button>
            <button type="button" onClick={() => setPage('settings')}>
              <span className="quick-icon">
                <Settings2 size={17} />
              </span>
              <span>
                <strong>调整设置</strong>
                <small>内存与 Java</small>
              </span>
              <ArrowUpRight size={14} />
            </button>
            <button type="button" onClick={() => setPage('worlds')}>
              <span className="quick-icon">
                <Wrench size={17} />
              </span>
              <span>
                <strong>世界工具</strong>
                <small>备份与分析</small>
              </span>
              <ArrowUpRight size={14} />
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
