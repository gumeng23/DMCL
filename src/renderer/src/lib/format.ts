import type { AccountType, InstanceTheme, LoaderType } from '@shared/types'

export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export function formatPlaytime(seconds: number): string {
  if (!seconds) return '0 分钟'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.round((seconds % 3600) / 60)
  if (hours > 0) return `${hours} 小时 ${minutes} 分钟`
  return `${Math.max(1, minutes)} 分钟`
}

export function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
  return String(value)
}

export function formatDate(value: string | number): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date)
}

export function relativeTime(value: string | number): string {
  if (!value) return '从未'
  const time = typeof value === 'string' ? new Date(value).getTime() : value
  if (!Number.isFinite(time)) return '从未'
  const diff = Date.now() - time
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  if (diff < 2_592_000_000) return `${Math.floor(diff / 86_400_000)} 天前`
  return formatDate(time)
}

export function todayLabel(): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  }).format(new Date())
}

export const accountKindLabel: Record<AccountType, string> = {
  offline: '离线账户',
  microsoft: 'Microsoft',
  authlib: '外置登录'
}

export const loaderLabel: Record<LoaderType, string> = {
  vanilla: '原版',
  fabric: 'Fabric',
  quilt: 'Quilt',
  forge: 'Forge',
  neoforge: 'NeoForge',
  optifine: 'OptiFine'
}

export const themeMeta: Record<
  InstanceTheme,
  { label: string; gradient: string; accent: string; glow: string }
> = {
  grass: {
    label: '草原',
    gradient: 'linear-gradient(135deg, #7bd64b 0%, #2d7a43 52%, #163d2c 100%)',
    accent: '#a8ff60',
    glow: 'rgba(133, 255, 95, 0.35)'
  },
  sunset: {
    label: '暮色',
    gradient: 'linear-gradient(135deg, #ffb45e 0%, #d66b49 48%, #5f2c45 100%)',
    accent: '#ffc37c',
    glow: 'rgba(255, 160, 90, 0.3)'
  },
  amethyst: {
    label: '紫晶',
    gradient: 'linear-gradient(135deg, #d09cff 0%, #7d5bdb 50%, #35255f 100%)',
    accent: '#d7b3ff',
    glow: 'rgba(180, 130, 255, 0.3)'
  },
  ocean: {
    label: '深海',
    gradient: 'linear-gradient(135deg, #66e0ff 0%, #2b7fcd 50%, #16315f 100%)',
    accent: '#7ee7ff',
    glow: 'rgba(90, 200, 255, 0.3)'
  },
  ember: {
    label: '余烬',
    gradient: 'linear-gradient(135deg, #ffd76e 0%, #e75b3c 50%, #4a1719 100%)',
    accent: '#ff9b6b',
    glow: 'rgba(255, 100, 70, 0.3)'
  },
  frost: {
    label: '霜原',
    gradient: 'linear-gradient(135deg, #d9fbff 0%, #82b8c8 48%, #304c5f 100%)',
    accent: '#c8f4ff',
    glow: 'rgba(180, 235, 255, 0.3)'
  }
}

export const allThemes = Object.keys(themeMeta) as InstanceTheme[]

export function shortVersion(id: string): string {
  if (!id) return '未选择版本'
  return id.replace(/^fabric-loader-/, 'Fabric ').replace(/-/g, ' · ')
}
