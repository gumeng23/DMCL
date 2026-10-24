import { Component, useState, type ErrorInfo, type ReactNode } from 'react'
import { AppProvider, useApp } from './state/AppContext'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { HomePage } from './pages/HomePage'
import { VersionsPage } from './pages/VersionsPage'
import { SettingsPage } from './pages/SettingsPage'
import { ModulePlaceholder } from './pages/ModulePlaceholder'
import { AccountDialog } from './components/AccountDialog'
import { InstanceDialog } from './components/InstanceDialog'
import { TaskDock } from './components/TaskDock'
import { ToastHost } from './components/ToastHost'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Renderer error', error, info)
    void window.amc?.reportError?.(`${error.stack || error.message}\n${info.componentStack || ''}`).catch(() => undefined)
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="boot-screen">
          <div className="boot-error-card">
            <div className="boot-error-icon">!</div>
            <h1>界面遇到了问题</h1>
            <p>{this.state.error.message}</p>
            <details className="boot-error-detail">
              <summary>查看错误详情</summary>
              <pre>{this.state.error.stack}</pre>
            </details>
            <div className="boot-error-actions">
              <button className="btn btn-primary" onClick={() => window.location.reload()}>
                重新加载
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  void navigator.clipboard?.writeText(this.state.error?.stack || '').catch(() => undefined)
                }}
              >
                复制错误信息
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function AppShell(): JSX.Element {
  const { page } = useApp()
  const [accountOpen, setAccountOpen] = useState(false)
  const [instanceOpen, setInstanceOpen] = useState(false)

  return (
    <div className="app-root">
      <Sidebar onAccount={() => setAccountOpen(true)} />
      <div className="app-main">
        <TopBar
          onAccount={() => setAccountOpen(true)}
          onCreateInstance={() => setInstanceOpen(true)}
        />
        <main className="content-scroll">
          <div className="page-transition" key={page}>
            {page === 'home' && <HomePage onAccount={() => setAccountOpen(true)} />}
            {page === 'versions' && <VersionsPage />}
            {page === 'settings' && <SettingsPage />}
            {page === 'mods' && <ModulePlaceholder kind="mods" />}
            {page === 'resources' && <ModulePlaceholder kind="resources" />}
            {page === 'worlds' && <ModulePlaceholder kind="worlds" />}
          </div>
        </main>
      </div>
      <AccountDialog open={accountOpen} onClose={() => setAccountOpen(false)} />
      <InstanceDialog open={instanceOpen} onClose={() => setInstanceOpen(false)} />
      <TaskDock />
      <ToastHost />
    </div>
  )
}

export function App(): JSX.Element {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppShell />
      </AppProvider>
    </ErrorBoundary>
  )
}
