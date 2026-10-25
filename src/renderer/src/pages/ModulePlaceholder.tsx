import { ArrowUpRight, FolderOpen, Image, Map, Puzzle, Sparkles } from 'lucide-react'
import type { PageId } from '@shared/types'
import { useApp } from '@renderer/state/AppContext'
import { api } from '@renderer/lib/native'
import { Badge } from '@renderer/components/Ui'
import { themeMeta } from '@renderer/lib/format'

const COPY = {
  mods: {
    eyebrow: 'MOD WORKSHOP',
    title: '模组工作台',
    kicker: '下一阶段接入',
    description:
      '按实例管理 Fabric / Forge 模组，自动读取模组信息，并从 Modrinth 一键获取内容。',
    icon: Puzzle,
    features: ['模组启用与停用', '依赖与版本自动匹配', 'Modrinth 内容发现']
  },
  resources: {
    eyebrow: 'CONTENT STUDIO',
    title: '资源与光影',
    kicker: '下一阶段接入',
    description:
      '集中管理资源包与光影包，预览包内信息，并为每个实例独立启用。',
    icon: Image,
    features: ['资源包排序与预览', '光影包管理', '拖放导入']
  },
  worlds: {
    eyebrow: 'WORLD VAULT',
    title: '世界保管库',
    kicker: '下一阶段接入',
    description:
      '浏览每个实例的存档，读取世界信息，并创建安全的本地备份。',
    icon: Map,
    features: ['存档信息解析', '一键压缩备份', '世界导入与导出']
  }
} as const

export function ModulePlaceholder({ kind }: { kind: Extract<PageId, 'mods' | 'resources' | 'worlds'> }): JSX.Element {
  const { selectedInstance } = useApp()
  const item = COPY[kind]
  const Icon = item.icon
  const theme = themeMeta[selectedInstance?.theme || 'grass']

  return (
    <div className="page placeholder-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow-line">
            <span className="eyebrow-dot" />
            {item.eyebrow}
          </div>
          <h1>{item.title}</h1>
          <p>{item.description}</p>
        </div>
        <div className="page-heading-actions">
          <Badge tone="amber">{item.kicker}</Badge>
        </div>
      </div>

      <div className="module-stage">
        <div className="module-art" style={{ background: theme.gradient }}>
          <div className="module-art-grid" />
          <span className="module-art-icon">
            <Icon size={56} strokeWidth={1.2} />
          </span>
          <span className="module-spark spark-a" />
          <span className="module-spark spark-b" />
          <span className="module-spark spark-c" />
        </div>
        <div className="module-copy">
          <span className="section-kicker">UNDER CONSTRUCTION</span>
          <h2>正在为「{selectedInstance?.name || '默认实例'}」装配这个空间</h2>
          <p>
            启动器的核心安装与启动流程已经可用。这个模块会在下一阶段完成接入，
            你的游戏数据不会受到影响。
          </p>
          <div className="module-features">
            {item.features.map((feature) => (
              <div key={feature}>
                <Sparkles size={14} />
                {feature}
              </div>
            ))}
          </div>
          <div className="module-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void api.instances.openFolder(selectedInstance.id)}
            >
              <FolderOpen size={15} />
              打开实例目录
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void api.shell.openExternal('https://modrinth.com/')}
            >
              先去看看 Modrinth
              <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="module-note">
            <span className="module-note-line" />
            <span>DMCL Roadmap · Phase 2</span>
          </div>
        </div>
      </div>

      <div className="module-roadmap">
        <div className="roadmap-step done">
          <span>01</span>
          <div>
            <strong>启动核心</strong>
            <p>版本安装、Java 管理与游戏启动</p>
          </div>
          <Badge tone="green">已完成</Badge>
        </div>
        <div className="roadmap-line" />
        <div className="roadmap-step active">
          <span>02</span>
          <div>
            <strong>内容生态</strong>
            <p>模组、资源包、光影和存档</p>
          </div>
          <Badge tone="amber">进行中</Badge>
        </div>
        <div className="roadmap-line" />
        <div className="roadmap-step">
          <span>03</span>
          <div>
            <strong>账户与联机</strong>
            <p>Microsoft、外置登录与服务集成</p>
          </div>
          <Badge tone="neutral">计划中</Badge>
        </div>
      </div>
    </div>
  )
}
