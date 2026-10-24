import { useEffect, useMemo, useState } from 'react'
import {
  Boxes,
  Check,
  ChevronRight,
  Download,
  Hammer,
  Layers3,
  Leaf,
  Puzzle,
  Sparkles
} from 'lucide-react'
import type { LoaderOption, LoaderType } from '@shared/types'
import { useApp } from '@renderer/state/AppContext'
import { api, errorMessage } from '@renderer/lib/native'
import { loaderLabel } from '@renderer/lib/format'
import { Badge, Spinner } from './Ui'
import { Modal } from './Modal'

const CHOICES: Array<{
  id: LoaderType
  description: string
  icon: typeof Boxes
  tone: string
}> = [
  { id: 'vanilla', description: '纯净的游戏本体，兼容性最好', icon: Boxes, tone: 'vanilla' },
  { id: 'fabric', description: '轻量、更新快的现代模组加载器', icon: Leaf, tone: 'fabric' },
  { id: 'forge', description: '模组生态最丰富的经典加载器', icon: Hammer, tone: 'forge' },
  { id: 'optifine', description: '光影、高清材质与性能优化', icon: Sparkles, tone: 'optifine' },
  { id: 'quilt', description: 'Fabric 生态的开放分支', icon: Puzzle, tone: 'quilt' }
]

function optionLabel(type: LoaderType, option: LoaderOption): string {
  if (type === 'optifine') {
    const [edition, patch] = option.version.split('/')
    return `OptiFine ${edition.replace(/_/g, ' ')} ${patch || ''}`
  }
  if (type === 'forge') return `Forge ${option.version}`
  if (type === 'fabric') return `Fabric Loader ${option.version}`
  if (type === 'quilt') return `Quilt Loader ${option.version}`
  return option.version
}

export function InstallVersionDialog({
  open,
  gameVersion,
  title,
  onClose,
  onInstalled
}: {
  open: boolean
  gameVersion: string
  title?: string
  onClose: () => void
  onInstalled: (versionId: string, loader: LoaderType) => Promise<void> | void
}): JSX.Element {
  const { toast } = useApp()
  const [loader, setLoader] = useState<LoaderType>('vanilla')
  const [options, setOptions] = useState<LoaderOption[]>([])
  const [loaderVersion, setLoaderVersion] = useState('')
  const [loading, setLoading] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setLoader('vanilla')
    setOptions([])
    setLoaderVersion('')
    setError('')
    setInstalling(false)
  }, [open, gameVersion])

  useEffect(() => {
    if (!open || loader === 'vanilla') {
      setOptions([])
      setLoaderVersion('')
      return
    }
    let cancelled = false
    setLoading(true)
    setError('')
    setOptions([])
    api.versions
      .loaders(gameVersion, loader)
      .then((result) => {
        if (cancelled) return
        setOptions(result)
        const preferred = result.find((item) => item.stable) || result[0]
        setLoaderVersion(preferred?.version || '')
        if (result.length === 0) setError('当前版本没有找到可用的加载器版本')
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, loader, gameVersion])

  const selected = useMemo(() => CHOICES.find((item) => item.id === loader), [loader])
  const SelectedIcon = selected?.icon || Boxes

  const install = async (): Promise<void> => {
    if (loader !== 'vanilla' && !loaderVersion) {
      setError('请选择一个加载器版本')
      return
    }
    setInstalling(true)
    setError('')
    try {
      const result = await api.versions.install({
        versionId: gameVersion,
        loader,
        loaderVersion: loader === 'vanilla' ? undefined : loaderVersion
      })
      await onInstalled(result.versionId, result.loader)
      toast(
        'success',
        loader === 'vanilla' ? '游戏安装完成' : `${loaderLabel[loader]} 已安装`,
        result.versionId
      )
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setInstalling(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={installing ? () => undefined : onClose}
      eyebrow="INSTALL GAME"
      title={`安装 ${title || gameVersion}`}
      description="选择原版游戏，或在安装时一并加入模组加载器与优化组件。"
      icon={<Download size={19} />}
      width={760}
      footer={
        <div className="modal-footer-row">
          <span className="modal-footer-hint">
            <Layers3 size={14} />
            {loader === 'vanilla'
              ? '原版安装不会修改游戏内容'
              : `${loaderLabel[loader]} 会自动安装到当前游戏目录`}
          </span>
          <div>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={installing}>
              取消
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void install()}
              disabled={installing || loading}
            >
              {installing ? <Spinner size={14} /> : <Download size={14} />}
              {installing ? '安装中…' : '开始安装'}
            </button>
          </div>
        </div>
      }
    >
      <div className="install-dialog">
        <div className="install-version-banner">
          <span className="install-version-cube" />
          <div>
            <span>目标游戏版本</span>
            <strong>Minecraft {gameVersion}</strong>
          </div>
          <Badge tone="green">Java Edition</Badge>
        </div>

        <div className="install-loader-grid">
          {CHOICES.map((choice) => {
            const Icon = choice.icon
            return (
              <button
                type="button"
                key={choice.id}
                className={`install-loader-card ${loader === choice.id ? 'active' : ''}`}
                onClick={() => {
                  setLoader(choice.id)
                  setError('')
                }}
                disabled={installing}
              >
                <span className={`install-loader-icon tone-${choice.tone}`}>
                  <Icon size={21} />
                </span>
                <span className="install-loader-copy">
                  <strong>{loaderLabel[choice.id]}</strong>
                  <span>{choice.description}</span>
                </span>
                {loader === choice.id && (
                  <span className="install-loader-check">
                    <Check size={12} />
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {loader !== 'vanilla' && (
          <div className="install-loader-options">
            <div className="install-options-head">
              <div>
                <span className="section-kicker">VERSION</span>
                <h3>
                  <SelectedIcon size={15} />
                  选择 {loaderLabel[loader]} 版本
                </h3>
              </div>
              {!loading && options.length > 0 && (
                <Badge tone="neutral">{options.length} 个可用</Badge>
              )}
            </div>
            {loading ? (
              <div className="install-options-loading">
                <Spinner size={17} />
                正在获取版本列表…
              </div>
            ) : options.length > 0 ? (
              <div className="loader-option-list">
                {options.map((option) => (
                  <button
                    type="button"
                    key={option.version}
                    className={`loader-option ${loaderVersion === option.version ? 'active' : ''}`}
                    onClick={() => setLoaderVersion(option.version)}
                    disabled={installing}
                  >
                    <span>
                      <strong>{optionLabel(loader, option)}</strong>
                      {option.stable && <Badge tone="green">推荐</Badge>}
                    </span>
                    <span className="loader-option-version">{option.version}</span>
                    <ChevronRight size={14} />
                  </button>
                ))}
              </div>
            ) : (
              <div className="install-options-empty">
                暂未找到适合 Minecraft {gameVersion} 的 {loaderLabel[loader]} 版本
              </div>
            )}
          </div>
        )}

        {error && <div className="install-error">{error}</div>}

        {loader === 'forge' && (
          <div className="install-tip">
            Forge 安装器会自动下载依赖并打补丁，首次安装可能需要几分钟。
          </div>
        )}
        {loader === 'optifine' && (
          <div className="install-tip">
            OptiFine 将作为独立版本安装，可用于原版光影与高清材质。
          </div>
        )}
      </div>
    </Modal>
  )
}
