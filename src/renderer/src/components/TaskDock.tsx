import { useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
  Terminal,
  X,
  XCircle
} from 'lucide-react'
import type { TaskProgress } from '@shared/types'
import { useApp } from '@renderer/state/AppContext'
import { api } from '@renderer/lib/native'
import { formatBytes } from '@renderer/lib/format'

const KIND_LABEL: Record<TaskProgress['kind'], string> = {
  version: '版本安装',
  loader: '加载器安装',
  java: '运行时',
  mod: '模组安装',
  resource: '资源安装',
  backup: '存档备份'
}

export function TaskDock(): JSX.Element | null {
  const { tasks } = useApp()
  const [expanded, setExpanded] = useState(false)
  const [hidden, setHidden] = useState<Set<string>>(new Set())

  const task = useMemo(() => {
    const visible = tasks.filter((item) => !hidden.has(item.id))
    return (
      visible.find((item) => item.status === 'running' || item.status === 'queued') ||
      visible[0]
    )
  }, [tasks, hidden])

  useEffect(() => {
    setExpanded(false)
  }, [task?.id])

  if (!task) return null
  const running = task.status === 'running' || task.status === 'queued'
  const indeterminate = running && !task.total
  const percent = Math.min(100, Math.max(0, task.percent || 0))

  const hide = (): void => {
    setHidden((current) => new Set(current).add(task.id))
  }

  return (
    <div className={`task-dock ${task.status}`}>
      <div className="task-head">
        <span className={`task-kind-icon ${running ? 'running' : ''}`}>
          {running ? <Download size={16} /> : <XCircle size={16} />}
        </span>
        <div className="task-head-copy">
          <span>{KIND_LABEL[task.kind]}</span>
          <strong>{task.title}</strong>
        </div>
        <div className="task-head-actions">
          {running && (
            <button
              type="button"
              className="task-cancel"
              onClick={() => void api.versions.cancel(task.id)}
              title="取消任务"
            >
              取消
            </button>
          )}
          {!running && (
            <button type="button" className="task-icon-button" onClick={hide} title="关闭">
              <X size={14} />
            </button>
          )}
          <button
            type="button"
            className="task-icon-button"
            onClick={() => setExpanded((value) => !value)}
            title={expanded ? '收起' : '展开'}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
      </div>

      <div className="task-progress-row">
        <div className={`task-progress ${indeterminate ? 'indeterminate' : ''}`}>
          <span style={{ width: indeterminate ? undefined : `${percent}%` }} />
        </div>
        <span className="task-percent">
          {task.status === 'success' ? '完成' : task.status === 'error' ? '失败' : task.status === 'cancelled' ? '已取消' : `${Math.round(percent)}%`}
        </span>
      </div>

      <div className="task-meta">
        <span className="task-stage">
          {task.status === 'running' && <Loader2 size={11} className="spin" />}
          {task.status === 'error' ? task.error || task.message : task.stage}
        </span>
        <span className="task-message">
          {task.status === 'running' && task.speed > 0 ? `${task.speed.toFixed(1)} MB/s` : ''}
          {task.total > 0 ? ` · ${task.current} / ${task.total}` : ''}
          {task.totalBytes > 0 && !task.speed ? ` · ${formatBytes(task.bytes)} / ${formatBytes(task.totalBytes)}` : ''}
        </span>
      </div>

      {expanded && (
        <div className="task-log">
          <div className="task-log-head">
            <Terminal size={12} />
            <span>任务日志</span>
          </div>
          {task.logs.length === 0 ? (
            <span className="task-log-empty">等待输出…</span>
          ) : (
            task.logs.slice(-8).map((line, index) => (
              <div className="task-log-line" key={`${index}-${line}`}>
                <span>›</span>
                {line}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
