import { useEffect, useMemo, useState } from 'react'
import {
  Boxes,
  Check,
  CloudDownload,
  Download,
  FolderOpen,
  HardDriveDownload,
  Layers3,
  Play,
  RefreshCcw,
  Search,
  Trash2
} from 'lucide-react'
import type { InstalledVersion, LoaderType, VersionSummary } from '@shared/types'
import { useApp } from '@renderer/state/AppContext'
import { api, errorMessage } from '@renderer/lib/native'
import { formatDate, loaderLabel, themeMeta } from '@renderer/lib/format'
import { Badge, EmptyState, Segmented, Spinner } from '@renderer/components/Ui'
import { ConfirmDialog } from '@renderer/components/ConfirmDialog'
import { InstallVersionDialog } from '@renderer/components/InstallVersionDialog'

type Tab = 'installed' | 'remote'
type TypeFilter = 'release' | 'snapshot' | 'special' | 'all'

const APRIL_FOOLS = new Set([
  '15w14a',
  '1.rv-pre1',
  '3d shareware v1.34',
  '20w14infinite',
  '22w13oneblockatatime',
  '23w13a_or_b',
  '24w14potato',
  '25w14craftmine'
])

function isSpecialVersion(version: VersionSummary): boolean {
  const id = version.id.toLowerCase()
  if (APRIL_FOOLS.has(id)) return true
  if (version.type === 'old_beta' || version.type === 'old_alpha') return false
  if (version.type === 'snapshot') return !/^\d{2}w\d{2}[a-z]$/.test(version.id)
  if (version.type === 'release') {
    return !/^\d+\.\d+(?:\.\d+)?(?:-(?:pre|rc)\d+)?$/.test(version.id)
  }
  return false
}

function typeLabel(type: string): string {
  if (type === 'release') return '正式版'
  if (type === 'snapshot') return '快照'
  if (type === 'old_beta') return '远古 Beta'
  if (type === 'old_alpha') return '远古 Alpha'
  return type
}

function typeTone(type: string): 'green' | 'amber' | 'neutral' | 'violet' {
  if (type === 'release') return 'green'
  if (type === 'snapshot') return 'amber'
  if (type === 'old_alpha') return 'violet'
  return 'neutral'
}

export function VersionsPage(): JSX.Element {
  const {
    data,
    selectedInstance,
    refreshInstalled,
    refreshAll,
    updateInstance,
    toast
  } = useApp()

  const installed = data.installedVersions
  const [tab, setTab] = useState<Tab>(installed.length ? 'installed' : 'remote')
  const [remote, setRemote] = useState<VersionSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<TypeFilter>('release')
  const [limit, setLimit] = useState(60)
  const [installTarget, setInstallTarget] = useState<{ gameVersion: string; title: string } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<InstalledVersion | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadRemote = async (force = false): Promise<void> => {
    setLoading(true)
    setLoadError('')
    try {
      const versions = await api.versions.remote(force)
      setRemote(versions)
    } catch (error) {
      setLoadError(errorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadRemote()
  }, [])

  const currentId = selectedInstance?.versionId || ''
  const installedIds = useMemo(() => new Set(installed.map((version) => version.id)), [installed])
  const installedMap = useMemo(
    () => new Map(installed.map((version) => [version.id, version])),
    [installed]
  )

  const filteredRemote = useMemo(() => {
    const query = search.trim().toLowerCase()
    return remote.filter((version) => {
      const special = isSpecialVersion(version)
      if (filter === 'release' && (version.type !== 'release' || special)) return false
      if (filter === 'snapshot' && (version.type !== 'snapshot' || special)) return false
      if (filter === 'special' && !special) return false
      if (query && !version.id.toLowerCase().includes(query)) return false
      return true
    })
  }, [remote, filter, search])

  const handleUse = async (version: InstalledVersion): Promise<void> => {
    if (!selectedInstance) return
    try {
      await updateInstance(selectedInstance.id, {
        versionId: version.id,
        loader: version.loader
      })
      toast('success', '已切换版本', `${selectedInstance.name} 现在使用 ${version.id}`)
    } catch (error) {
      toast('error', '切换失败', errorMessage(error))
    }
  }

  const handleInstalled = async (versionId: string, loader: LoaderType): Promise<void> => {
    await refreshInstalled()
    if (selectedInstance) {
      await updateInstance(selectedInstance.id, { versionId, loader })
    }
    setTab('installed')
  }

  const handleDelete = async (): Promise<void> => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.versions.remove(deleteTarget.id)
      await refreshAll()
      toast('success', '版本已删除', deleteTarget.id)
      setDeleteTarget(null)
    } catch (error) {
      toast('error', '删除失败', errorMessage(error))
    } finally {
      setDeleting(false)
    }
  }

  const theme = themeMeta[selectedInstance?.theme || 'grass']

  return (
    <div className="page versions-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow-line">
            <span className="eyebrow-dot" />
            VERSION LIBRARY
          </div>
          <h1>版本库</h1>
          <p>安装、整理并使用不同版本，探索每一个时代的 Minecraft。</p>
        </div>
        <div className="page-heading-actions">
          <button type="button" className="btn btn-ghost" onClick={() => void loadRemote(true)} disabled={loading}>
            <RefreshCcw size={15} className={loading ? 'spin' : ''} />
            刷新列表
          </button>
          <div className="mini-instance-pill">
            <span className="mini-instance-cover" style={{ background: theme.gradient }} />
            <span>{selectedInstance?.name}</span>
          </div>
        </div>
      </div>

      <div className="library-overview">
        <div className="library-stat">
          <span className="library-icon green">
            <Boxes size={18} />
          </span>
          <div>
            <span>已安装</span>
            <strong>{installed.length}</strong>
          </div>
        </div>
        <div className="library-stat">
          <span className="library-icon blue">
            <CloudDownload size={18} />
          </span>
          <div>
            <span>最新正式版</span>
            <strong>{data.latestRelease?.id || '—'}</strong>
          </div>
        </div>
        <div className="library-stat">
          <span className="library-icon amber">
            <HardDriveDownload size={18} />
          </span>
          <div>
            <span>最新快照</span>
            <strong>{data.latestSnapshot?.id || '—'}</strong>
          </div>
        </div>
        <div className="library-stat library-path">
          <div>
            <span>版本存储位置</span>
            <strong title={data.paths.versionsDir}>{data.paths.versionsDir}</strong>
          </div>
          <button type="button" onClick={() => void api.shell.openPath(data.paths.versionsDir)}>
            <FolderOpen size={15} />
          </button>
        </div>
      </div>

      <div className="library-toolbar">
        <div className="library-tabs">
          <button
            type="button"
            className={tab === 'installed' ? 'active' : ''}
            onClick={() => setTab('installed')}
          >
            已安装
            <span>{installed.length}</span>
          </button>
          <button type="button" className={tab === 'remote' ? 'active' : ''} onClick={() => setTab('remote')}>
            全部版本
            <span>{remote.length || '...'}</span>
          </button>
        </div>
        {tab === 'remote' && (
          <div className="library-tools">
            <div className="search-field small">
              <Search size={15} />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setLimit(60)
                }}
                placeholder="搜索版本号…"
              />
            </div>
            <Segmented<TypeFilter>
              value={filter}
              onChange={(value) => {
                setFilter(value)
                setLimit(60)
              }}
              options={[
                { value: 'release', label: '正式版' },
                { value: 'snapshot', label: '预览版' },
                { value: 'special', label: '愚人节' },
                { value: 'all', label: '全部' }
              ]}
            />
          </div>
        )}
      </div>

      {tab === 'installed' ? (
        installed.length === 0 ? (
          <div className="panel empty-panel">
            <EmptyState
              icon={Boxes}
              title="还没有安装任何版本"
              description="从版本库选择一个正式版开始，DMCL 会自动完成客户端与资源下载。"
              action={
                <button type="button" className="btn btn-primary" onClick={() => setTab('remote')}>
                  <Download size={15} />
                  浏览可用版本
                </button>
              }
            />
          </div>
        ) : (
          <div className="version-list installed-list">
            {installed.map((version) => {
              const current = version.id === currentId
              return (
                <div className={`version-row ${current ? 'current' : ''}`} key={version.id}>
                  <div className="version-badge">
                    <span className="version-cube" />
                  </div>
                  <div className="version-main">
                    <div className="version-name-line">
                      <strong>{version.id}</strong>
                      {current && (
                        <Badge tone="green">
                          <Check size={10} /> 当前实例
                        </Badge>
                      )}
                      {version.loader !== 'vanilla' && <Badge tone="violet">{loaderLabel[version.loader]}</Badge>}
                    </div>
                    <div className="version-meta-line">
                      <span>{typeLabel(version.type)}</span>
                      <i />
                      <span>基础版本 {version.baseVersion}</span>
                      <i />
                      <span>Java {version.javaMajor}+</span>
                      <i />
                      <span>安装于 {formatDate(version.installedAt)}</span>
                    </div>
                  </div>
                  <div className="version-actions">
                    <button
                      type="button"
                      className="btn btn-small btn-ghost"
                      onClick={() => setInstallTarget({ gameVersion: version.baseVersion, title: version.baseVersion })}
                    >
                      <Layers3 size={14} />
                      加载器
                    </button>
                    <button
                      type="button"
                      className="btn btn-small btn-ghost"
                      onClick={() => void api.shell.openPath(`${data.paths.versionsDir}\\${version.id}`)}
                    >
                      <FolderOpen size={14} />
                      打开
                    </button>
                    {current ? (
                      <span className="version-current-mark">
                        <Check size={14} /> 使用中
                      </span>
                    ) : (
                      <button type="button" className="btn btn-small btn-soft" onClick={() => void handleUse(version)}>
                        <Play size={13} fill="currentColor" />
                        使用
                      </button>
                    )}
                    <button
                      type="button"
                      className="icon-button danger"
                      title="删除版本"
                      onClick={() => setDeleteTarget(version)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )
      ) : (
        <div className="panel remote-panel">
          {loadError ? (
            <EmptyState
              icon={CloudDownload}
              title="版本列表获取失败"
              description={loadError}
              action={
                <button type="button" className="btn btn-primary" onClick={() => void loadRemote(true)}>
                  <RefreshCcw size={15} />
                  重新获取
                </button>
              }
            />
          ) : loading && remote.length === 0 ? (
            <div className="list-loading">
              <Spinner size={20} />
              <span>正在获取版本清单…</span>
            </div>
          ) : (
            <>
              <div className="remote-head">
                <span>版本</span>
                <span>类型</span>
                <span>发布时间</span>
                <span>操作</span>
              </div>
              <div className="remote-list">
                {filteredRemote.slice(0, limit).map((version, index) => {
                  const isInstalled = installedIds.has(version.id)
                  const known = installedMap.get(version.id)
                  const special = isSpecialVersion(version)
                  return (
                    <div className="remote-row" key={version.id}>
                      <div className="remote-version">
                        <span className="remote-index">{String(index + 1).padStart(2, '0')}</span>
                        <strong>{version.id}</strong>
                        {version.id === data.latestRelease?.id && <Badge tone="green">最新</Badge>}
                        {special && <Badge tone="amber">愚人节</Badge>}
                      </div>
                      <div>
                        <Badge tone={special ? 'violet' : typeTone(version.type)}>
                          {special ? '特殊版本' : typeLabel(version.type)}
                        </Badge>
                      </div>
                      <div className="remote-date">{formatDate(version.releaseTime)}</div>
                      <div className="remote-actions">
                        {isInstalled ? (
                          <>
                            <span className="installed-mark">
                              <Check size={13} />
                              已安装
                            </span>
                            <button
                              type="button"
                              className="btn btn-small btn-ghost"
                              onClick={() =>
                                setInstallTarget({ gameVersion: version.id, title: version.id })
                              }
                            >
                              <Layers3 size={13} />
                              加载器
                            </button>
                            {known && known.id !== currentId && (
                              <button
                                type="button"
                                className="btn btn-small btn-ghost"
                                onClick={() => void handleUse(known)}
                              >
                                使用
                              </button>
                            )}
                          </>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-small btn-soft"
                            onClick={() =>
                              setInstallTarget({ gameVersion: version.id, title: version.id })
                            }
                          >
                            <Download size={13} />
                            安装
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              {filteredRemote.length === 0 && (
                <EmptyState
                  icon={Search}
                  title="没有找到匹配的版本"
                  description="试试其他关键词，或者切换筛选条件。"
                />
              )}
              {filteredRemote.length > limit && (
                <button type="button" className="load-more" onClick={() => setLimit((value) => value + 80)}>
                  显示更多版本
                  <span>{filteredRemote.length - limit}</span>
                </button>
              )}
            </>
          )}
        </div>
      )}

      <InstallVersionDialog
        open={Boolean(installTarget)}
        gameVersion={installTarget?.gameVersion || ''}
        title={installTarget?.title}
        onClose={() => setInstallTarget(null)}
        onInstalled={handleInstalled}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="删除这个版本？"
        description={`将从磁盘移除 ${deleteTarget?.id || ''} 的版本文件。使用该版本的实例会失去关联，但存档不会被删除。`}
        confirmLabel="删除版本"
        danger
        busy={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  )
}
