import { useState, type ReactNode } from 'react'
import { Loader2, type LucideIcon } from 'lucide-react'
import type { AccountInfo } from '@shared/types'

export function BrandCube({ size = 34 }: { size?: number }): JSX.Element {
  return (
    <svg className="brand-cube-svg" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="cubeTop" x1="10" y1="6" x2="50" y2="34" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ddff9a" />
          <stop offset="1" stopColor="#9ae94d" />
        </linearGradient>
        <linearGradient id="cubeLeft" x1="8" y1="28" x2="31" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4f9b3b" />
          <stop offset="1" stopColor="#245426" />
        </linearGradient>
        <linearGradient id="cubeRight" x1="32" y1="31" x2="56" y2="54" gradientUnits="userSpaceOnUse">
          <stop stopColor="#83d54c" />
          <stop offset="1" stopColor="#3f8135" />
        </linearGradient>
      </defs>
      <path d="M32 5 57 19 32 33 7 19 32 5Z" fill="url(#cubeTop)" />
      <path d="M7 19 32 33v27L7 46V19Z" fill="url(#cubeLeft)" />
      <path d="M57 19 32 33v27l25-14V19Z" fill="url(#cubeRight)" />
      <path d="M16 25.2 25 30v5.2l-9-4.9v-5.1Z" fill="#c6ff76" opacity=".55" />
      <path d="M32 33v27" stroke="#10260f" strokeOpacity=".25" />
    </svg>
  )
}

export function Spinner({ size = 16 }: { size?: number }): JSX.Element {
  return <Loader2 size={size} className="spin" aria-label="加载中" />
}

export function Switch({
  checked,
  onChange,
  disabled
}: {
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
}): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={`switch ${checked ? 'is-on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  )
}

export function AccountAvatar({
  account,
  size = 40,
  className = ''
}: {
  account?: AccountInfo
  size?: number
  className?: string
}): JSX.Element {
  const [broken, setBroken] = useState(false)
  const initial = (account?.name || '?').slice(0, 1).toUpperCase()
  const style = { width: size, height: size }
  if (account?.avatarUrl && !broken) {
    return (
      <div className={`account-avatar image ${className}`} style={style}>
        <img src={account.avatarUrl} alt={account.name} onError={() => setBroken(true)} />
      </div>
    )
  }
  return (
    <div className={`account-avatar ${className}`} style={style}>
      <span className="avatar-grid" />
      <span className="avatar-initial">{initial}</span>
    </div>
  )
}

export function Badge({
  children,
  tone = 'neutral',
  className = ''
}: {
  children: ReactNode
  tone?: 'neutral' | 'green' | 'amber' | 'blue' | 'violet' | 'red'
  className?: string
}): JSX.Element {
  return <span className={`badge badge-${tone} ${className}`}>{children}</span>
}

export function IconTile({
  icon: Icon,
  tone = 'green',
  size = 38
}: {
  icon: LucideIcon
  tone?: 'green' | 'blue' | 'amber' | 'violet' | 'neutral'
  size?: number
}): JSX.Element {
  return (
    <span className={`icon-tile tile-${tone}`} style={{ width: size, height: size }}>
      <Icon size={Math.round(size * 0.46)} strokeWidth={1.9} />
    </span>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
}): JSX.Element {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon size={28} strokeWidth={1.6} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange
}: {
  value: T
  options: Array<{ value: T; label: ReactNode }>
  onChange: (value: T) => void
}): JSX.Element {
  return (
    <div className="segmented">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={value === option.value ? 'active' : ''}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function KeyValue({
  label,
  children
}: {
  label: string
  children: ReactNode
}): JSX.Element {
  return (
    <div className="kv-row">
      <span>{label}</span>
      <div>{children}</div>
    </div>
  )
}
