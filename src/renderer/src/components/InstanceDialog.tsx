import { useEffect, useState } from 'react'
import { Boxes, Check, Layers3, Plus, Sparkles } from 'lucide-react'
import type { InstanceTheme } from '@shared/types'
import { useApp } from '@renderer/state/AppContext'
import { allThemes, loaderLabel, themeMeta } from '@renderer/lib/format'
import { errorMessage } from '@renderer/lib/native'
import { Badge, Spinner } from './Ui'
import { Modal } from './Modal'

export function InstanceDialog({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}): JSX.Element {
  const { data, createInstance, toast, setPage } = useApp()
  const [name, setName] = useState('新的冒险')
  const [versionId, setVersionId] = useState('')
  const [theme, setTheme] = useState<InstanceTheme>('grass')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setName('新的冒险')
    const preferred =
      data.installedVersions[0]?.id || data.latestRelease?.id || ''
    setVersionId(preferred)
    setTheme('grass')
    setError('')
  }, [open, data.installedVersions, data.latestRelease])

  const versions = [
    ...data.installedVersions.map((version) => ({
      id: version.id,
      label: `${version.id} · 已安装`,
      installed: true
    })),
    ...(data.latestRelease && !data.installedVersions.some((version) => version.id === data.latestRelease?.id)
      ? [
          {
            id: data.latestRelease.id,
            label: `${data.latestRelease.id} · 最新正式版`,
            installed: false
          }
        ]
      : [])
  ]

  const submit = async (): Promise<void> => {
    if (!name.trim()) {
      setError('请为实例起一个名字')
      return
    }
    setBusy(true)
    setError('')
    try {
      const instance = await createInstance({
        name: name.trim(),
        versionId,
        loader: 'vanilla',
        theme
      })
      toast('success', '实例已创建', `${instance.name} 已经准备好`)
      onClose()
      if (versionId && !data.installedVersions.some((version) => version.id === versionId)) {
        setPage('versions')
      }
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="NEW INSTANCE"
      title="创建新的游戏实例"
      description="每个实例都有独立的模组、资源包和存档，互不干扰。"
      icon={<Layers3 size={19} />}
      width={620}
      footer={
        <div className="modal-footer-row">
          <span className="modal-footer-hint">
            <Sparkles size={13} />
            游戏数据将存放在独立目录
          </span>
          <div>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
              取消
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void submit()} disabled={busy}>
              {busy ? <Spinner size={14} /> : <Plus size={14} />}
              创建实例
            </button>
          </div>
        </div>
      }
    >
      <div className="instance-form">
        <label className="form-label">
          实例名称
          <div className={`text-input ${error ? 'has-error' : ''}`}>
            <Boxes size={15} />
            <input
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setError('')
              }}
              placeholder="例如：生存、红石实验室"
              maxLength={32}
              autoFocus
            />
          </div>
          {error && <span className="form-error">{error}</span>}
        </label>

        <label className="form-label">
          游戏版本
          <select value={versionId} onChange={(event) => setVersionId(event.target.value)}>
            <option value="">稍后选择</option>
            {versions.map((version) => (
              <option key={version.id} value={version.id}>
                {version.label}
              </option>
            ))}
          </select>
          <span className="field-hint">
            未安装的版本会在你开始游戏前自动提示安装。
          </span>
        </label>

        <div className="form-label">
          实例主题
          <div className="theme-picker">
            {allThemes.map((item) => (
              <button
                type="button"
                key={item}
                className={`theme-swatch ${theme === item ? 'active' : ''}`}
                style={{ background: themeMeta[item].gradient }}
                onClick={() => setTheme(item)}
                title={themeMeta[item].label}
              >
                {theme === item && (
                  <span>
                    <Check size={14} />
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="instance-form-info">
          <div>
            <span>加载器</span>
            <strong>{loaderLabel.vanilla}</strong>
          </div>
          <div>
            <span>数据隔离</span>
            <strong>已启用</strong>
          </div>
          <div>
            <span>存储位置</span>
            <strong>AMCL / instances</strong>
          </div>
          <Badge tone="green">独立存档</Badge>
        </div>
      </div>
    </Modal>
  )
}
