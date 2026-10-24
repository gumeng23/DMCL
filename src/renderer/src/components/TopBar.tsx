import { useEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  CirclePlus,
  Maximize2,
  Minimize2,
  Minus,
  Moon,
  Sun,
  Wifi,
  WifiOff,
  X
} from 'lucide-react'
import type { PageId } from '@shared/types'
import { useApp } from '@renderer/state/AppContext'
import { api, errorMessage } from '@renderer/lib/native'
import { themeMeta } from '@renderer/lib/format'
import { AccountAvatar } from './Ui'

const PAGE_META: Record<PageId, { title: string; sub: string }> = {
  home: { title: '首页', sub: '你的下一段冒险' },
  versions: { title: '版本库', sub: '游戏版本与加载器' },
  mods: { title: '模组', sub: '为世界增添更多可能' },
  resources: { title: '资源', sub: '材质、光影与声音' },
  worlds: { title: '存档', sub: '珍惜每一个世界' },
  settings: { title: '设置', sub: '让启动器更合你的习惯' }
}

export function TopBar({
  onAccount,
  onCreateInstance
}: {
  onAccount: () => void
  onCreateInstance: () => void
}): JSX.Element {
  const { page, data, selectInstance, selectedInstance, selectedAccount, toast, updateSettings } = useApp()
  const [maximized, setMaximized] = useState(false)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const switcherRef = useRef<HTMLDivElement>(null)
  const meta = PAGE_META[page]

  useEffect(() => {
    void api.window.isMaximized().then(setMaximized)
    return api.events.onMaximizeChange(setMaximized)
  }, [])

  useEffect(() => {
    if (!switcherOpen) return
    const close = (event: MouseEvent): void => {
      if (switcherRef.current && !switcherRef.current.contains(event.target as Node)) {
        setSwitcherOpen(false)
      }
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [switcherOpen])

  const handleSwitch = async (id: string): Promise<void> => {
    setSwitcherOpen(false)
    if (id === data.selectedInstanceId) return
    try {
      await selectInstance(id)
    } catch (error) {
      toast('error', '切换实例失败', errorMessage(error))
    }
  }

  return (
    <header
      className="topbar"
      onDoubleClick={(event) => {
        if (!(event.target as HTMLElement).closest('.no-drag')) void api.window.toggleMaximize()
      }}
    >
      <div className="topbar-context">
        <div className="topbar-title">{meta.title}</div>
        <div className="topbar-sub">{meta.sub}</div>
      </div>

      <div className="topbar-drag" />

      <div className="topbar-right no-drag">
        <div className={`online-state ${data.online ? 'online' : 'offline'}`}>
          {data.online ? <Wifi size={13} /> : <WifiOff size={13} />}
          <span>{data.online ? '在线' : '离线'}</span>
        </div>

        <button
          type="button"
          className="topbar-theme-toggle"
          title={data.settings.theme === 'dark' ? '切换到亮色主题' : '切换到暗色主题'}
          onClick={() => {
            const next = data.settings.theme === 'dark' ? 'light' : 'dark'
            void updateSettings({ theme: next }).catch((error) =>
              toast('error', '切换主题失败', errorMessage(error))
            )
          }}
        >
          {data.settings.theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        <div className="instance-switcher" ref={switcherRef}>
          <button
            type="button"
            className={`instance-trigger ${switcherOpen ? 'open' : ''}`}
            onClick={() => setSwitcherOpen((value) => !value)}
          >
            <span
              className="instance-dot"
              style={{
                background: selectedInstance ? themeMeta[selectedInstance.theme]?.gradient : undefined
              }}
            />
            <span className="instance-trigger-copy">
              <strong>{selectedInstance?.name || '选择实例'}</strong>
              <span>{selectedInstance?.versionId || '尚未选择版本'}</span>
            </span>
            <ChevronDown size={14} className={switcherOpen ? 'rotated' : ''} />
          </button>
          {switcherOpen && (
            <div className="instance-popover">
              <div className="popover-head">
                <span>切换实例</span>
                <button
                  type="button"
                  onClick={() => {
                    setSwitcherOpen(false)
                    onCreateInstance()
                  }}
                >
                  <CirclePlus size={14} />
                  新建
                </button>
              </div>
              <div className="instance-list">
                {data.instances.map((instance) => (
                  <button
                    type="button"
                    key={instance.id}
                    className={`instance-option ${
                      instance.id === data.selectedInstanceId ? 'active' : ''
                    }`}
                    onClick={() => void handleSwitch(instance.id)}
                  >
                    <span
                      className="instance-cover"
                      style={{ background: themeMeta[instance.theme]?.gradient }}
                    >
                      <span />
                    </span>
                    <span className="instance-option-copy">
                      <strong>{instance.name}</strong>
                      <span>{instance.versionId || '尚未选择版本'}</span>
                    </span>
                    {instance.id === data.selectedInstanceId && <span className="instance-current">当前</span>}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="popover-footer-button"
                onClick={() => {
                  setSwitcherOpen(false)
                  onCreateInstance()
                }}
              >
                <CirclePlus size={15} />
                创建新的游戏实例
              </button>
            </div>
          )}
        </div>

        <button type="button" className="topbar-account" onClick={onAccount} title="账户">
          <AccountAvatar account={selectedAccount} size={32} />
        </button>

        <div className="window-controls">
          <button type="button" onClick={() => void api.window.minimize()} title="最小化">
            <Minus size={15} />
          </button>
          <button
            type="button"
            onClick={() => void api.window.toggleMaximize().then(setMaximized)}
            title={maximized ? '还原' : '最大化'}
          >
            {maximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
          <button type="button" className="window-close" onClick={() => void api.window.close()} title="关闭">
            <X size={15} />
          </button>
        </div>
      </div>
    </header>
  )
}
