import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import type {
  AccountInfo,
  BootstrapData,
  CreateInstanceInput,
  Instance,
  LaunchLog,
  LaunchState,
  PageId,
  Settings,
  TaskProgress,
  ToastPayload
} from '@shared/types'
import { api, errorMessage } from '@renderer/lib/native'

export interface AppToast extends ToastPayload {
  createdAt: number
}

interface AppContextValue {
  data: BootstrapData
  page: PageId
  setPage: (page: PageId) => void
  tasks: TaskProgress[]
  latestTask: TaskProgress | null
  launchStates: Record<string, LaunchState>
  logs: LaunchLog[]
  toasts: AppToast[]
  toast: (type: ToastPayload['type'], title: string, message?: string) => void
  dismissToast: (id: string) => void
  refreshAll: () => Promise<void>
  refreshInstalled: () => Promise<void>
  refreshAccounts: () => Promise<void>
  selectInstance: (id: string) => Promise<void>
  updateInstance: (id: string, patch: Partial<Instance>) => Promise<Instance>
  createInstance: (input: CreateInstanceInput) => Promise<Instance>
  removeInstance: (id: string) => Promise<void>
  selectAccount: (id: string) => Promise<void>
  addOfflineAccount: (name: string) => Promise<AccountInfo>
  removeAccount: (id: string) => Promise<void>
  updateSettings: (patch: Partial<Settings>) => Promise<Settings>
  startGame: () => Promise<void>
  stopGame: () => Promise<void>
  launching: boolean
  selectedInstance: Instance
  selectedAccount: AccountInfo | undefined
  selectedAccountId: string
  isRunning: boolean
}

const AppContext = createContext<AppContextValue | null>(null)

function initialPage(): PageId {
  if (window.amc.debugInitialPage) return window.amc.debugInitialPage
  const page = new URLSearchParams(window.location.search).get('page')
  if (page === 'versions' || page === 'mods' || page === 'resources' || page === 'worlds' || page === 'settings') {
    return page
  }
  return 'home'
}

export function AppProvider({ children }: { children: ReactNode }): JSX.Element {
  const [data, setData] = useState<BootstrapData | null>(null)
  const [loadError, setLoadError] = useState('')
  const [page, setPage] = useState<PageId>(initialPage)
  const [tasks, setTasks] = useState<Record<string, TaskProgress>>({})
  const [launchStates, setLaunchStates] = useState<Record<string, LaunchState>>({})
  const [logs, setLogs] = useState<LaunchLog[]>([])
  const [toasts, setToasts] = useState<AppToast[]>([])
  const [launching, setLaunching] = useState(false)
  const notifiedTasks = useRef(new Set<string>())
  const launchStatus = useRef<Record<string, string>>({})

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id))
  }, [])

  const toast = useCallback(
    (type: ToastPayload['type'], title: string, message?: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
      setToasts((current) => [...current.slice(-4), { id, type, title, message, createdAt: Date.now() }])
      window.setTimeout(() => dismissToast(id), type === 'error' ? 6500 : 4200)
    },
    [dismissToast]
  )

  const load = useCallback(async () => {
    setLoadError('')
    try {
      const bootstrap = await api.bootstrap()
      setData(bootstrap)
      const running = await api.launch.running().catch(() => [])
      setLaunchStates(Object.fromEntries(running.map((state) => [state.instanceId, state])))
    } catch (error) {
      setLoadError(errorMessage(error))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const theme = data?.settings.theme || 'dark'
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
  }, [data?.settings.theme])

  useEffect(() => {
    const offTask = api.events.onTask((task) => {
      setTasks((current) => ({ ...current, [task.id]: task }))
      if (task.status === 'success' && !notifiedTasks.current.has(task.id)) {
        notifiedTasks.current.add(task.id)
        toast('success', task.title, task.message)
      }
      if (task.status === 'error' && !notifiedTasks.current.has(task.id)) {
        notifiedTasks.current.add(task.id)
        toast('error', task.title, task.error || task.message)
      }
    })
    const offState = api.events.onLaunchState((state) => {
      setLaunchStates((current) => ({ ...current, [state.instanceId]: state }))
      if (launchStatus.current[state.instanceId] === state.status) return
      launchStatus.current[state.instanceId] = state.status
      if (state.status === 'running') {
        toast('success', '游戏已启动', state.message || '祝你玩得开心！')
        setLaunching(false)
      }
      if (state.status === 'crashed') {
        toast('error', '游戏异常退出', state.message || '请检查启动日志')
        setLaunching(false)
      }
      if (state.status === 'exited') {
        toast('info', '游戏已退出', state.message || '')
        setLaunching(false)
      }
    })
    const offLog = api.events.onLaunchLog((log) => {
      setLogs((current) => [...current.slice(-249), log])
    })
    const offToast = api.events.onToast((payload) => {
      setToasts((current) => [
        ...current.slice(-4),
        { ...payload, createdAt: Date.now() }
      ])
      window.setTimeout(() => dismissToast(payload.id), 4500)
    })
    return () => {
      offTask()
      offState()
      offLog()
      offToast()
    }
  }, [dismissToast, toast])

  const refreshAll = useCallback(async () => {
    const bootstrap = await api.bootstrap()
    setData(bootstrap)
  }, [])

  const refreshInstalled = useCallback(async () => {
    const installed = await api.versions.installed()
    setData((current) => (current ? { ...current, installedVersions: installed } : current))
  }, [])

  const refreshAccounts = useCallback(async () => {
    const bootstrap = await api.bootstrap()
    setData((current) =>
      current
        ? {
            ...current,
            settings: bootstrap.settings,
            accounts: bootstrap.accounts,
            selectedAccountId: bootstrap.selectedAccountId
          }
        : bootstrap
    )
  }, [])

  const selectInstance = useCallback(async (id: string) => {
    await api.instances.select(id)
    setData((current) =>
      current
        ? {
            ...current,
            selectedInstanceId: id,
            instances: current.instances.map((instance) =>
              instance.id === id ? { ...instance } : instance
            )
          }
        : current
    )
  }, [])

  const updateInstance = useCallback(async (id: string, patch: Partial<Instance>) => {
    const updated = await api.instances.update(id, patch)
    setData((current) =>
      current
        ? {
            ...current,
            instances: current.instances.map((instance) => (instance.id === id ? updated : instance))
          }
        : current
    )
    return updated
  }, [])

  const createInstance = useCallback(async (input: CreateInstanceInput) => {
    const instance = await api.instances.create(input)
    setData((current) =>
      current
        ? {
            ...current,
            instances: [...current.instances, instance],
            selectedInstanceId: instance.id
          }
        : current
    )
    return instance
  }, [])

  const removeInstance = useCallback(async (id: string) => {
    await api.instances.remove(id)
    const bootstrap = await api.bootstrap()
    setData(bootstrap)
  }, [])

  const selectAccount = useCallback(async (id: string) => {
    await api.accounts.select(id)
    setData((current) =>
      current
        ? {
            ...current,
            selectedAccountId: id,
            accounts: current.accounts.map((account) =>
              account.id === id ? { ...account, lastUsedAt: Date.now() } : account
            )
          }
        : current
    )
  }, [])

  const addOfflineAccount = useCallback(async (name: string) => {
    const account = await api.accounts.addOffline(name)
    const bootstrap = await api.bootstrap()
    setData(bootstrap)
    return account
  }, [])

  const removeAccount = useCallback(async (id: string) => {
    await api.accounts.remove(id)
    const bootstrap = await api.bootstrap()
    setData(bootstrap)
  }, [])

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    const settings = await api.settings.update(patch)
    setData((current) => (current ? { ...current, settings } : current))
    return settings
  }, [])

  const selectedInstance = useMemo(() => {
    if (!data) return undefined
    return data.instances.find((item) => item.id === data.selectedInstanceId) || data.instances[0]
  }, [data])

  const selectedAccount = useMemo(
    () => data?.accounts.find((item) => item.id === data.selectedAccountId),
    [data]
  )

  const isRunning = useMemo(() => {
    if (!data) return false
    const state = launchStates[data.selectedInstanceId]
    return Boolean(state && ['preparing', 'launching', 'running'].includes(state.status))
  }, [data, launchStates])

  const startGame = useCallback(async () => {
    if (!data) return
    const instance = data.instances.find((item) => item.id === data.selectedInstanceId) || data.instances[0]
    if (!instance) return
    if (!instance.versionId) {
      toast('info', '还没有选择版本', '请先在版本库中安装或选择一个游戏版本')
      setPage('versions')
      return
    }
    if (!data.installedVersions.some((version) => version.id === instance.versionId)) {
      toast('info', '游戏版本尚未安装', '请先在版本库中安装所选版本')
      setPage('versions')
      return
    }
    setLaunching(true)
    try {
      await api.launch.start(instance.id)
      setPage('home')
    } catch (error) {
      setLaunching(false)
      setLaunchStates((current) => {
        const next = { ...current }
        const state = next[instance.id]
        if (state && !['running', 'exited', 'crashed'].includes(state.status)) delete next[instance.id]
        return next
      })
      toast('error', '启动失败', errorMessage(error))
    }
  }, [data, setPage, toast])

  const stopGame = useCallback(async () => {
    if (!data) return
    try {
      await api.launch.stop(data.selectedInstanceId)
    } catch (error) {
      toast('error', '结束游戏失败', errorMessage(error))
    }
  }, [data, toast])

  const sortedTasks = useMemo(
    () => Object.values(tasks).sort((a, b) => b.startedAt - a.startedAt),
    [tasks]
  )

  if (loadError) {
    return (
      <div className="boot-screen">
        <div className="boot-error-card">
          <div className="boot-error-icon">!</div>
          <h1>启动器加载失败</h1>
          <p>{loadError}</p>
          <button className="btn btn-primary" onClick={() => void load()}>
            重试
          </button>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="boot-screen">
        <div className="boot-mark">
          <div className="brand-cube large">
            <span className="cube-top" />
            <span className="cube-left" />
            <span className="cube-right" />
          </div>
        </div>
        <div className="boot-name">AMCL</div>
        <div className="boot-tagline">正在准备你的世界</div>
        <div className="boot-bar">
          <span />
        </div>
      </div>
    )
  }

  const value: AppContextValue = {
    data,
    page,
    setPage,
    tasks: sortedTasks,
    latestTask: sortedTasks[0] || null,
    launchStates,
    logs,
    toasts,
    toast,
    dismissToast,
    refreshAll,
    refreshInstalled,
    refreshAccounts,
    selectInstance,
    updateInstance,
    createInstance,
    removeInstance,
    selectAccount,
    addOfflineAccount,
    removeAccount,
    updateSettings,
    startGame,
    stopGame,
    launching,
    selectedInstance: selectedInstance as Instance,
    selectedAccount,
    selectedAccountId: data.selectedAccountId,
    isRunning
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used inside AppProvider')
  return context
}
