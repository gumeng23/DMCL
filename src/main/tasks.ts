import { EventEmitter } from 'node:events'
import { randomUUID } from 'node:crypto'
import type { TaskProgress, TaskStatus } from '../shared/types'

const MAX_LOGS = 120

export interface TaskUpdate {
  stage?: string
  current?: number
  total?: number
  bytes?: number
  totalBytes?: number
  percent?: number
  speed?: number
  message?: string
}

export class TaskHandle {
  readonly id: string
  readonly kind: TaskProgress['kind']
  readonly title: string
  readonly controller = new AbortController()
  private parent: TaskManager
  private state: TaskProgress
  private lastEmit = 0
  private pendingTimer: NodeJS.Timeout | null = null

  constructor(parent: TaskManager, kind: TaskProgress['kind'], title: string) {
    this.parent = parent
    this.id = randomUUID()
    this.kind = kind
    this.title = title
    this.state = {
      id: this.id,
      kind,
      title,
      stage: '准备中',
      current: 0,
      total: 0,
      bytes: 0,
      totalBytes: 0,
      percent: 0,
      speed: 0,
      status: 'running',
      message: '',
      logs: [],
      startedAt: Date.now()
    }
    parent.emitUpdate(this.state)
  }

  get signal(): AbortSignal {
    return this.controller.signal
  }

  update(patch: TaskUpdate, force = false): void {
    this.state = { ...this.state, ...patch }
    if (
      patch.total !== undefined &&
      patch.total > 0 &&
      patch.percent === undefined &&
      patch.current !== undefined
    ) {
      this.state.percent = Math.min(99.5, (patch.current / patch.total) * 100)
    }
    if (patch.percent !== undefined) {
      this.state.percent = Math.max(0, Math.min(100, patch.percent))
    }
    const now = Date.now()
    if (force || now - this.lastEmit > 120) {
      this.lastEmit = now
      this.parent.emitUpdate(this.state)
    } else if (!this.pendingTimer) {
      this.pendingTimer = setTimeout(() => {
        this.pendingTimer = null
        this.parent.emitUpdate(this.state)
      }, 140)
    }
  }

  log(line: string): void {
    const clean = line.replace(/\r/g, '')
    this.state.logs = [...this.state.logs.slice(-(MAX_LOGS - 1)), clean]
    this.parent.emitUpdate(this.state)
  }

  success(message = '完成'): void {
    this.flushTimer()
    this.state = {
      ...this.state,
      status: 'success',
      stage: message,
      message,
      percent: 100,
      current: this.state.total || this.state.current,
      finishedAt: Date.now()
    }
    this.parent.emitUpdate(this.state, true)
  }

  fail(error: unknown): void {
    this.flushTimer()
    const message = error instanceof Error ? error.message : String(error)
    this.state = {
      ...this.state,
      status: this.controller.signal.aborted ? 'cancelled' : 'error',
      stage: this.controller.signal.aborted ? '已取消' : '安装失败',
      message,
      error: message,
      finishedAt: Date.now()
    }
    this.parent.emitUpdate(this.state, true)
  }

  cancelled(): void {
    this.flushTimer()
    this.state = {
      ...this.state,
      status: 'cancelled',
      stage: '已取消',
      message: '任务已取消',
      finishedAt: Date.now()
    }
    this.parent.emitUpdate(this.state, true)
  }

  private flushTimer(): void {
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer)
      this.pendingTimer = null
    }
  }
}

export class TaskManager extends EventEmitter {
  private tasks = new Map<string, TaskHandle>()

  create(kind: TaskProgress['kind'], title: string): TaskHandle {
    const handle = new TaskHandle(this, kind, title)
    this.tasks.set(handle.id, handle)
    handle.controller.signal.addEventListener('abort', () => {
      if (handle['state'].status === 'running') {
        handle['state'] = {
          ...handle['state'],
          status: 'cancelled',
          stage: '正在取消',
          message: '正在取消任务…'
        }
        this.emitUpdate(handle['state'], true)
      }
    })
    return handle
  }

  cancel(taskId: string): boolean {
    const task = this.tasks.get(taskId)
    if (!task) return false
    task.controller.abort()
    return true
  }

  emitUpdate(state: TaskProgress, force = false): void {
    void force
    this.emit('task', { ...state, logs: [...state.logs] })
  }

  get(taskId: string): TaskHandle | undefined {
    return this.tasks.get(taskId)
  }

  cleanup(): void {
    const cutoff = Date.now() - 1000 * 60 * 30
    for (const [id, task] of this.tasks) {
      if (task['state'].finishedAt && task['state'].finishedAt < cutoff) this.tasks.delete(id)
    }
  }
}

export const taskManager = new TaskManager()

export function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    const error = new Error('任务已取消')
    error.name = 'AbortError'
    throw error
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || /aborted|cancel/i.test(error.message))
}

export type { TaskStatus }
