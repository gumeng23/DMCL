import { useEffect, useRef, useState } from 'react'
import {
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  KeyRound,
  Loader2,
  LogIn,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound
} from 'lucide-react'
import type { AccountType, MicrosoftFlow } from '@shared/types'
import { useApp } from '@renderer/state/AppContext'
import { accountKindLabel } from '@renderer/lib/format'
import { api, errorMessage } from '@renderer/lib/native'
import { AccountAvatar, Badge, Spinner } from './Ui'
import { Modal } from './Modal'

type Method = 'offline' | 'microsoft' | 'authlib'

export function AccountDialog({ open, onClose }: { open: boolean; onClose: () => void }): JSX.Element {
  const {
    data,
    selectedAccount,
    selectedAccountId,
    selectAccount,
    addOfflineAccount,
    removeAccount,
    refreshAccounts,
    toast
  } = useApp()
  const [method, setMethod] = useState<Method>('offline')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [removing, setRemoving] = useState<string | null>(null)
  const [msClientId, setMsClientId] = useState('')
  const [msFlow, setMsFlow] = useState<MicrosoftFlow | null>(null)
  const [msBusy, setMsBusy] = useState(false)
  const [msBrowserBusy, setMsBrowserBusy] = useState(false)
  const [msError, setMsError] = useState('')
  const pollBusy = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setMethod('offline')
      setName('')
      setError('')
      setRemoving(null)
      setMsFlow(null)
      setMsError('')
      setMsBusy(false)
      setMsBrowserBusy(false)
      setMsClientId(data.settings.msClientId || '')
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open, data.settings.msClientId])

  useEffect(() => {
    if (!open || !msFlow) return
    let cancelled = false
    const interval = Math.max(5, msFlow.interval || 5) * 1000
    const poll = async (): Promise<void> => {
      if (cancelled || pollBusy.current) return
      pollBusy.current = true
      try {
        await api.accounts.microsoftPoll(msFlow.flowId)
        if (cancelled) return
        await refreshAccounts()
        toast('success', 'Microsoft 登录成功', '已切换到正版账户')
        setMsFlow(null)
        onClose()
      } catch (err) {
        const message = errorMessage(err)
        if (message === 'AUTHORIZATION_PENDING' || message === 'AUTHORIZATION_SLOW_DOWN') return
        if (!cancelled) {
          setMsError(message)
          setMsFlow(null)
        }
      } finally {
        pollBusy.current = false
      }
    }
    const first = window.setTimeout(() => void poll(), 1200)
    const timer = window.setInterval(() => void poll(), interval)
    return () => {
      cancelled = true
      window.clearTimeout(first)
      window.clearInterval(timer)
    }
  }, [open, msFlow, refreshAccounts, toast, onClose])

  const handleSelect = async (id: string): Promise<void> => {
    if (id === selectedAccountId) return
    setBusy(true)
    try {
      await selectAccount(id)
      toast('success', '已切换账户')
    } catch (err) {
      toast('error', '切换失败', errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const handleAdd = async (): Promise<void> => {
    if (!name.trim()) {
      setError('请输入玩家名')
      return
    }
    setBusy(true)
    setError('')
    try {
      await addOfflineAccount(name.trim())
      toast('success', '离线账户已添加', `${name.trim()} 已设为当前账户`)
      setName('')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async (id: string): Promise<void> => {
    setBusy(true)
    try {
      await removeAccount(id)
      setRemoving(null)
      toast('success', '账户已移除')
    } catch (err) {
      toast('error', '移除失败', errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const handleBrowserLogin = async (): Promise<void> => {
    setMsBrowserBusy(true)
    setMsError('')
    try {
      await api.accounts.microsoftBrowserLogin(msClientId.trim() || undefined)
      await refreshAccounts()
      toast('success', 'Microsoft 登录成功', '已切换到正版账户')
      onClose()
    } catch (err) {
      setMsError(errorMessage(err))
    } finally {
      setMsBrowserBusy(false)
    }
  }

  const methodItems: Array<{ id: Method; label: string; hint: string; icon: typeof UserRound; enabled: boolean }> = [
    { id: 'offline', label: '离线账户', hint: '无需网络，适合单机', icon: UserRound, enabled: true },
    { id: 'microsoft', label: 'Microsoft', hint: '正版登录', icon: ShieldCheck, enabled: true },
    { id: 'authlib', label: '外置登录', hint: '皮肤站认证 · 即将接入', icon: KeyRound, enabled: false }
  ]

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="ACCOUNT CENTER"
      title="账户中心"
      description="管理启动游戏时使用的玩家身份。"
      icon={<UserRound size={19} />}
      width={780}
    >
      <div className="account-layout">
        <div className="account-list-panel">
          <div className="account-panel-title">
            <span>已添加的账户</span>
            <Badge tone="neutral">{data.accounts.length}</Badge>
          </div>
          <div className="account-list">
            {data.accounts.map((account) => (
              <div
                key={account.id}
                className={`account-item ${account.id === selectedAccountId ? 'active' : ''}`}
              >
                <button type="button" className="account-item-main" onClick={() => void handleSelect(account.id)}>
                  <AccountAvatar account={account} size={38} />
                  <span className="account-item-copy">
                    <strong>{account.name}</strong>
                    <span>
                      {accountKindLabel[account.kind]}
                      <i>·</i>
                      {account.kind === 'offline' ? '本地身份' : '已连接'}
                    </span>
                  </span>
                  {account.id === selectedAccountId && (
                    <span className="account-check">
                      <Check size={13} />
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  className="account-remove"
                  title="移除账户"
                  onClick={() => setRemoving(account.id)}
                >
                  <Trash2 size={13} />
                </button>
                {removing === account.id && (
                  <div className="account-remove-confirm">
                    <span>移除这个账户？</span>
                    <button type="button" onClick={() => setRemoving(null)}>
                      取消
                    </button>
                    <button type="button" className="danger-text" onClick={() => void handleRemove(account.id)}>
                      移除
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="account-list-note">
            <ShieldCheck size={14} />
            <span>账户信息仅存储在本机，启动游戏时才会用于身份验证。</span>
          </div>
        </div>

        <div className="account-add-panel">
          <div className="account-method-tabs">
            {methodItems.map((item) => {
              const Icon = item.icon
              return (
                <button
                  type="button"
                  key={item.id}
                  className={method === item.id ? 'active' : ''}
                  onClick={() => {
                    setMethod(item.id)
                    setError('')
                  }}
                  disabled={!item.enabled}
                >
                  <Icon size={15} />
                  <span>{item.label}</span>
                  {!item.enabled && <i>即将接入</i>}
                </button>
              )
            })}
          </div>

          {method === 'offline' ? (
            <div className="offline-form">
              <div className="offline-avatar-preview">
                <AccountAvatar
                  account={{
                    id: 'preview',
                    kind: 'offline',
                    name: name || '?',
                    uuid: '',
                    skinModel: 'classic',
                    createdAt: 0,
                    lastUsedAt: 0
                  }}
                  size={68}
                />
                <span className="offline-avatar-ring" />
              </div>
              <h3>创建一个离线身份</h3>
              <p>输入你希望在单人游戏和离线服务器中显示的名字。</p>
              <label className="form-label">
                玩家名
                <div className={`text-input ${error ? 'has-error' : ''}`}>
                  <UserRound size={15} />
                  <input
                    ref={inputRef}
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value)
                      setError('')
                    }}
                    placeholder="3-16 位字母、数字或下划线"
                    maxLength={16}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void handleAdd()
                    }}
                  />
                </div>
                {error && <span className="form-error">{error}</span>}
              </label>
              <button type="button" className="btn btn-primary account-add-button" disabled={busy} onClick={() => void handleAdd()}>
                {busy ? <Spinner size={15} /> : <Plus size={15} />}
                创建并切换
              </button>
              <div className="offline-feature-list">
                <div>
                  <Check size={13} />
                  支持单人游戏与离线服务器
                </div>
                <div>
                  <Check size={13} />
                  可随时切换多个身份
                </div>
              </div>
            </div>
          ) : method === 'microsoft' ? (
            <div className="ms-login-form">
              <div className="ms-login-hero">
                <span className="ms-login-hero-icon">
                  <ShieldCheck size={26} />
                </span>
                <div>
                  <h3>Microsoft 正版登录</h3>
                  <p>打开浏览器完成登录，应用会自动接上，无需手动输入验证码。</p>
                </div>
              </div>

              {msFlow ? (
                <div className="ms-code-panel">
                  <span>在浏览器中输入以下代码</span>
                  <div className="ms-user-code">{msFlow.userCode}</div>
                  <div className="ms-code-actions">
                    <button
                      type="button"
                      className="btn btn-small btn-ghost"
                      onClick={() => {
                        void navigator.clipboard?.writeText(msFlow.userCode)
                        toast('success', '验证码已复制')
                      }}
                    >
                      <Copy size={13} />
                      复制代码
                    </button>
                    <button
                      type="button"
                      className="btn btn-small btn-primary"
                      onClick={() => void api.shell.openExternal(msFlow.verificationUri)}
                    >
                      <ExternalLink size={13} />
                      打开登录页面
                    </button>
                  </div>
                  <div className="ms-waiting">
                    <Loader2 size={13} className="spin" />
                    等待 Microsoft 授权… 完成后会自动登录
                  </div>
                  <button
                    type="button"
                    className="text-button"
                    style={{ marginTop: 10 }}
                    onClick={() => setMsFlow(null)}
                  >
                    取消登录
                  </button>
                </div>
              ) : (
                <>
                  <label className="form-label">
                    应用 Client ID
                    <div className="text-input">
                      <KeyRound size={15} />
                      <input
                        value={msClientId}
                        onChange={(event) => {
                          setMsClientId(event.target.value)
                          setMsError('')
                        }}
                        placeholder="Azure 应用注册中获取的客户端 ID"
                        spellCheck={false}
                        disabled={msBusy || msBrowserBusy}
                      />
                    </div>
                    <span className="field-hint">
                      首次使用填写一次即可，之后会自动记住。
                    </span>
                  </label>
                  {msError && <div className="ms-error">{msError}</div>}
                  {msBrowserBusy ? (
                    <div className="ms-browser-waiting">
                      <Loader2 size={17} className="spin" />
                      <div>
                        <strong>已在浏览器打开登录页面</strong>
                        <span>请完成 Microsoft 登录，成功后 DMCL 会自动登录。</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn btn-primary account-add-button"
                        disabled={msBrowserBusy || msBusy}
                        onClick={() => void handleBrowserLogin()}
                      >
                        <ExternalLink size={15} />
                        打开浏览器并登录
                      </button>
                      <button
                        type="button"
                        className="text-button ms-device-toggle"
                        disabled={msBusy}
                        onClick={() => {
                          setMsBusy(true)
                          setMsError('')
                          api.accounts
                            .microsoftStart(msClientId.trim() || undefined)
                            .then((flow) => {
                              setMsClientId(msClientId.trim())
                              setMsFlow(flow)
                            })
                            .catch((err) => setMsError(errorMessage(err)))
                            .finally(() => setMsBusy(false))
                        }}
                      >
                        {msBusy ? <Spinner size={12} /> : <LogIn size={12} />}
                        改用设备代码登录
                      </button>
                    </>
                  )}
                  <div className="ms-help">
                    <strong>如何获取 Client ID？</strong>
                    <br />
                    Azure Portal → 注册「个人 Microsoft 账户」应用 → 身份验证中启用「公共客户端流」，
                    并添加重定向 URI <code>http://localhost</code>。然后把应用程序（客户端）ID 填入上方。
                    <br />
                    <button
                      type="button"
                      onClick={() =>
                        void api.shell.openExternal(
                          'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade'
                        )
                      }
                    >
                      打开 Azure 应用注册
                      <ExternalLink size={10} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="account-future">
              <span className="future-icon">
                <KeyRound size={26} />
              </span>
              <h3>外置账户登录</h3>
              <p>连接支持 authlib-injector 的皮肤站，使用站点账户进入服务器。</p>
              <div className="future-progress">
                <span>正在接入</span>
                <div>
                  <i style={{ width: '38%' }} />
                </div>
              </div>
              <button type="button" className="btn btn-ghost" disabled>
                <LogIn size={14} />
                即将开放
                <ChevronRight size={13} />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="account-footer-note">
        当前身份：<strong>{selectedAccount?.name || '未选择'}</strong>
        <span />
        Microsoft 登录需要 Azure 应用 Client ID，令牌使用系统加密保存
      </div>
    </Modal>
  )
}
