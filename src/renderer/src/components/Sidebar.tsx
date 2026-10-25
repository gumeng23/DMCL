import {
  Boxes,
  ChevronRight,
  Compass,
  Map,
  Palette,
  Puzzle,
  Settings2,
  Sparkles
} from 'lucide-react'
import type { PageId } from '@shared/types'
import { useApp } from '@renderer/state/AppContext'
import { accountKindLabel } from '@renderer/lib/format'
import { AccountAvatar, BrandCube } from './Ui'

const NAV_ITEMS: Array<{
  id: PageId
  label: string
  hint: string
  icon: typeof Compass
}> = [
  { id: 'home', label: '首页', hint: '总览', icon: Compass },
  { id: 'versions', label: '版本库', hint: '游戏与整合包', icon: Boxes },
  { id: 'mods', label: '模组', hint: '扩展内容', icon: Puzzle },
  { id: 'resources', label: '资源', hint: '材质与光影', icon: Palette },
  { id: 'worlds', label: '存档', hint: '世界与备份', icon: Map },
  { id: 'settings', label: '设置', hint: '偏好与运行时', icon: Settings2 }
]

export function Sidebar({ onAccount }: { onAccount: () => void }): JSX.Element {
  const { page, setPage, data, selectedAccount, selectedInstance } = useApp()
  const installedCount = data.installedVersions.length

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">
          <BrandCube size={34} />
        </div>
        <div className="brand-copy">
          <div className="brand-name">DMCL</div>
          <div className="brand-sub">MINECRAFT LAUNCHER</div>
        </div>
      </div>

      <div className="sidebar-section-label">PLAYGROUND</div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active = page === item.id
          return (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${active ? 'active' : ''}`}
              onClick={() => setPage(item.id)}
            >
              <span className="nav-icon">
                <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
              </span>
              <span className="nav-text">
                <span className="nav-label">{item.label}</span>
                <span className="nav-hint">{item.hint}</span>
              </span>
              {item.id === 'versions' && installedCount > 0 && (
                <span className="nav-count">{installedCount}</span>
              )}
              {active && <span className="nav-active-dot" />}
            </button>
          )
        })}
      </nav>

      <div className="sidebar-spacer" />

      <div className="sidebar-instance">
        <div className="sidebar-instance-top">
          <Sparkles size={13} />
          <span>当前实例</span>
        </div>
        <div className="sidebar-instance-name">{selectedInstance?.name || '未选择实例'}</div>
        <div className="sidebar-instance-meta">
          {selectedInstance?.versionId || '尚未安装版本'}
          <ChevronRight size={13} />
        </div>
      </div>

      <button type="button" className="account-mini" onClick={onAccount}>
        <AccountAvatar account={selectedAccount} size={38} />
        <span className="account-mini-copy">
          <strong>{selectedAccount?.name || '添加账户'}</strong>
          <span>{selectedAccount ? accountKindLabel[selectedAccount.kind] : '点击登录'}</span>
        </span>
        <span className="account-mini-chevron">
          <ChevronRight size={15} />
        </span>
      </button>

      <div className="sidebar-footer">
        <span className="footer-pulse" />
        <span>DMCL {data.appVersion}</span>
        <span className="footer-divider" />
        <span>{data.online ? '服务在线' : '离线模式'}</span>
      </div>
    </aside>
  )
}
