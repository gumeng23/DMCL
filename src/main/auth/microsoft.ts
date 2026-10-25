import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { shell } from 'electron'
import type { AccountInfo, MicrosoftFlow } from '../../shared/types'
import { getJson, HttpError, postForm, postJson } from '../http'
import { store, type StoredAccount } from '../store'
import { logger } from '../logger'

const DEVICE_CODE_URL = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode'
const TOKEN_URL = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token'
const XBL_URL = 'https://user.auth.xboxlive.com/user/authenticate'
const XSTS_URL = 'https://xsts.auth.xboxlive.com/xsts/authorize'
const MC_LOGIN_URL = 'https://api.minecraftservices.com/authentication/login_with_xbox'
const MC_PROFILE_URL = 'https://api.minecraftservices.com/minecraft/profile'
const SCOPE = 'XboxLive.signin offline_access'

interface DeviceCodeResponse {
  device_code?: string
  user_code?: string
  verification_uri?: string
  expires_in?: number
  interval?: number
  message?: string
  error?: string
  error_description?: string
}

interface TokenResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}

interface XblResponse {
  Token?: string
  DisplayClaims?: { xui?: Array<{ uhs?: string; xid?: string }> }
  error?: string
  message?: string
}

interface XstsResponse extends XblResponse {
  XErr?: number
}

interface McLoginResponse {
  access_token?: string
  expires_in?: number
  error?: string
  errorMessage?: string
}

interface McProfile {
  id?: string
  name?: string
  skins?: Array<{ state?: string; url?: string }>
  error?: string
  errorMessage?: string
}

interface FlowRecord {
  clientId: string
  deviceCode: string
  expiresAt: number
}

const flows = new Map<string, FlowRecord>()

function clientIdFrom(value?: string): string {
  const id = (value || store.settings.msClientId || '').trim()
  if (!id) {
    throw new Error('请先在账户中心 → Microsoft 中填写 Azure 应用 Client ID')
  }
  return id
}

function oauthError(data: DeviceCodeResponse | TokenResponse): string {
  return data.error_description || data.error || 'Microsoft 认证失败'
}

function xstsMessage(code: number): string {
  if (code === 2148916233) return '此 Microsoft 账户还没有 Xbox 档案，请先在 xbox.com 创建'
  if (code === 2148916235) return '该账户所在地区不支持 Xbox Live'
  if (code === 2148916236 || code === 2148916237) return '该账户需要完成年龄验证'
  if (code === 2148916238) return '未成年账户需要由家庭组织者完成授权'
  if (code === 2148916227) return '该 Microsoft 账户已被 Xbox Live 封禁'
  return `Xbox Live 验证失败（错误码 ${code}）`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function loginPage(title: string, message: string, success: boolean): string {
  const accent = success ? '#7fcf46' : '#e66d62'
  return `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} · DMCL</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0b1110;color:#eef6ef;font-family:'Segoe UI','Microsoft YaHei',sans-serif">
  <main style="width:min(440px,calc(100vw - 48px));padding:34px;border:1px solid rgba(255,255,255,.1);border-radius:20px;background:#121b18;text-align:center">
    <div style="width:54px;height:54px;margin:0 auto 18px;border-radius:16px;display:grid;place-items:center;background:rgba(127,207,70,.1);border:1px solid ${accent}44;color:${accent};font-size:26px">${success ? '✓' : '!'}</div>
    <h1 style="margin:0 0 8px;font-size:22px">${escapeHtml(title)}</h1>
    <p style="margin:0;color:#93a398;font-size:13px;line-height:1.8">${escapeHtml(message)}</p>
    <div style="margin-top:24px;color:#5e6e62;font-size:10px;letter-spacing:1.8px">DMCL · MICROSOFT LOGIN</div>
  </main>
</body>
</html>`
}

async function performXboxLogin(
  msAccessToken: string
): Promise<{ token: string; uhs: string; xid: string }> {
  const xbl = await postJson<XblResponse>(XBL_URL, {
    Properties: {
      AuthMethod: 'RPS',
      SiteName: 'user.auth.xboxlive.com',
      RpsTicket: `d=${msAccessToken}`
    },
    RelyingParty: 'http://auth.xboxlive.com',
    TokenType: 'JWT'
  }, { timeoutMs: 30_000 })
  if (xbl.status !== 200 || !xbl.data.Token) {
    throw new Error(xbl.data.message || xbl.data.error || 'Xbox Live 身份验证失败')
  }

  const xsts = await postJson<XstsResponse>(XSTS_URL, {
    Properties: {
      SandboxId: 'RETAIL',
      UserTokens: [xbl.data.Token]
    },
    RelyingParty: 'rp://api.minecraftservices.com/',
    TokenType: 'JWT'
  }, { timeoutMs: 30_000 })
  if (xsts.status !== 200 || !xsts.data.Token) {
    if (xsts.data.XErr) throw new Error(xstsMessage(xsts.data.XErr))
    throw new Error('Xbox 安全令牌获取失败')
  }
  const uhs = xsts.data.DisplayClaims?.xui?.[0]?.uhs
  const xid = xsts.data.DisplayClaims?.xui?.[0]?.xid
  if (!uhs) throw new Error('Xbox 返回数据缺少用户标识')
  return { token: xsts.data.Token, uhs, xid: xid || '' }
}

async function completeLogin(
  msAccessToken: string,
  refreshToken: string,
  clientId: string
): Promise<StoredAccount> {
  const { token, uhs, xid } = await performXboxLogin(msAccessToken)

  const login = await postJson<McLoginResponse>(
    MC_LOGIN_URL,
    { identityToken: `XBL3.0 x=${uhs};${token}` },
    { timeoutMs: 30_000 }
  )
  if (login.status !== 200 || !login.data.access_token) {
    throw new Error(login.data.errorMessage || login.data.error || 'Minecraft 登录失败')
  }

  let profile: McProfile
  try {
    profile = await getJson<McProfile>(MC_PROFILE_URL, {
      timeoutMs: 30_000,
      retries: 1,
      headers: { Authorization: `Bearer ${login.data.access_token}` }
    })
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      throw new Error('这个 Microsoft 账户没有购买 Minecraft: Java Edition')
    }
    throw new Error(`无法获取 Minecraft 档案：${error instanceof Error ? error.message : String(error)}`)
  }
  if (!profile.id || !profile.name) throw new Error('Microsoft 账户没有可用的 Minecraft 档案')

  const now = Date.now()
  const stored = await store.addAccount({
    kind: 'microsoft',
    name: profile.name,
    uuid: profile.id,
    skinModel: 'classic',
    avatarUrl: `https://mc-heads.net/avatar/${profile.id}/96`,
    accessToken: login.data.access_token,
    refreshToken,
    expiresAt: now + (login.data.expires_in || 86400) * 1000,
    xuid: xid,
    msClientId: clientId
  })
  logger.info(`Microsoft 账户登录成功：${profile.name}`)
  return stored
}

export class MicrosoftAuthService {
  /**
   * Opens the default browser and waits for the loopback OAuth callback.
   * Requires the Azure app to allow public clients and a http://localhost redirect URI.
   */
  async browserLogin(clientIdInput?: string): Promise<AccountInfo> {
    const clientId = clientIdFrom(clientIdInput)
    const verifier = randomBytes(48).toString('base64url')
    const challenge = createHash('sha256').update(verifier).digest('base64url')
    const state = randomBytes(18).toString('hex')

    return await new Promise<AccountInfo>((resolve, reject) => {
      let settled = false
      let callbackUrl = ''
      let timer: NodeJS.Timeout

      const finish = (error: Error | null, account?: AccountInfo): void => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        try {
          server.close()
        } catch {
          // Server may not have started.
        }
        if (error) reject(error)
        else if (account) resolve(account)
        else reject(new Error('Microsoft 登录未完成'))
      }

      const server = createServer(async (req, res) => {
        try {
          const requestUrl = new URL(req.url || '/', 'http://localhost')
          if (requestUrl.pathname !== '/auth/callback') {
            res.writeHead(404)
            res.end('Not found')
            return
          }
          const error = requestUrl.searchParams.get('error')
          const returnedState = requestUrl.searchParams.get('state')
          if (error) {
            const description = requestUrl.searchParams.get('error_description') || error
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
            res.end(loginPage('登录未完成', description, false))
            finish(new Error(description))
            return
          }
          if (returnedState !== state) {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
            res.end(loginPage('登录校验失败', 'state 不匹配，请返回启动器重试。', false))
            finish(new Error('Microsoft 登录校验失败，请重试'))
            return
          }
          const code = requestUrl.searchParams.get('code')
          if (!code) {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
            res.end(loginPage('登录未完成', '没有收到授权代码。', false))
            finish(new Error('没有收到 Microsoft 授权代码'))
            return
          }
          const token = await postForm<TokenResponse>(TOKEN_URL, {
            grant_type: 'authorization_code',
            client_id: clientId,
            code,
            redirect_uri: callbackUrl,
            code_verifier: verifier
          })
          if (token.status !== 200 || !token.data.access_token || !token.data.refresh_token) {
            throw new Error(oauthError(token.data))
          }
          const stored = await completeLogin(
            token.data.access_token,
            token.data.refresh_token,
            clientId
          )
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(loginPage('登录成功', 'DMCL 已完成 Microsoft 登录，可以关闭此页面。', true))
          finish(null, store.accountInfo(stored))
        } catch (error) {
          try {
            res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' })
            res.end(
              loginPage(
                '登录失败',
                error instanceof Error ? error.message : String(error),
                false
              )
            )
          } catch {
            // The browser may already be closed.
          }
          finish(error instanceof Error ? error : new Error(String(error)))
        }
      })

      server.on('error', (error) => finish(error))
      server.listen(0, async () => {
        const address = server.address()
        if (!address || typeof address === 'string') {
          finish(new Error('无法启动本地登录回调服务'))
          return
        }
        callbackUrl = `http://localhost:${address.port}/auth/callback`
        const authUrl =
          'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?' +
          new URLSearchParams({
            client_id: clientId,
            response_type: 'code',
            redirect_uri: callbackUrl,
            response_mode: 'query',
            scope: SCOPE,
            state,
            code_challenge: challenge,
            code_challenge_method: 'S256',
            prompt: 'select_account'
          }).toString()
        try {
          await shell.openExternal(authUrl)
        } catch (error) {
          finish(error instanceof Error ? error : new Error(String(error)))
        }
      })

      timer = setTimeout(
        () => finish(new Error('Microsoft 登录等待超时，请重新尝试')),
        10 * 60_000
      )
    })
  }

  async start(clientIdInput?: string): Promise<MicrosoftFlow> {
    const clientId = clientIdFrom(clientIdInput)
    const response = await postForm<DeviceCodeResponse>(DEVICE_CODE_URL, {
      client_id: clientId,
      scope: SCOPE
    })
    if (response.status !== 200 || !response.data.device_code || !response.data.user_code) {
      throw new Error(oauthError(response.data))
    }
    const flowId = randomUUID()
    const expiresIn = Number(response.data.expires_in) || 900
    const interval = Number(response.data.interval) || 5
    flows.set(flowId, {
      clientId,
      deviceCode: response.data.device_code,
      expiresAt: Date.now() + expiresIn * 1000
    })
    return {
      flowId,
      userCode: response.data.user_code,
      verificationUri: response.data.verification_uri || 'https://microsoft.com/devicelogin',
      expiresIn,
      interval,
      message: response.data.message || '请打开登录页面并输入代码'
    }
  }

  async poll(flowId: string): Promise<AccountInfo> {
    const flow = flows.get(flowId)
    if (!flow) throw new Error('登录流程已失效，请重新开始')
    if (Date.now() > flow.expiresAt) {
      flows.delete(flowId)
      throw new Error('设备代码已过期，请重新开始登录')
    }
    const response = await postForm<TokenResponse>(TOKEN_URL, {
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      client_id: flow.clientId,
      device_code: flow.deviceCode
    })
    if (response.data.error === 'authorization_pending') {
      throw new Error('AUTHORIZATION_PENDING')
    }
    if (response.data.error === 'slow_down') {
      throw new Error('AUTHORIZATION_SLOW_DOWN')
    }
    if (response.status !== 200 || response.data.error) {
      flows.delete(flowId)
      throw new Error(oauthError(response.data))
    }
    if (!response.data.access_token || !response.data.refresh_token) {
      flows.delete(flowId)
      throw new Error('Microsoft 返回的令牌无效')
    }
    flows.delete(flowId)
    const stored = await completeLogin(
      response.data.access_token,
      response.data.refresh_token,
      flow.clientId
    )
    return store.accountInfo(stored)
  }

  async refresh(account: StoredAccount): Promise<StoredAccount> {
    if (!account.refreshToken) throw new Error('Microsoft 登录已失效，请重新登录')
    const clientId = account.msClientId || clientIdFrom()
    const response = await postForm<TokenResponse>(TOKEN_URL, {
      grant_type: 'refresh_token',
      client_id: clientId,
      refresh_token: account.refreshToken
    })
    if (response.status !== 200 || !response.data.access_token) {
      throw new Error('Microsoft 登录已失效，请重新登录')
    }
    const refreshed = await completeLogin(
      response.data.access_token,
      response.data.refresh_token || account.refreshToken,
      clientId
    )
    return refreshed
  }

  /** Returns an account with a valid Minecraft access token, refreshing it when needed. */
  async ensureFresh(accountId: string): Promise<StoredAccount> {
    const account = store.findAccountById(accountId)
    if (!account) throw new Error('账户不存在')
    if (account.kind !== 'microsoft') return account
    if (account.accessToken && account.expiresAt && account.expiresAt > Date.now() + 120_000) {
      return account
    }
    const refreshed = await this.refresh(account)
    const current = store.findAccountById(accountId)
    if (current) {
      current.accessToken = refreshed.accessToken
      current.refreshToken = refreshed.refreshToken
      current.expiresAt = refreshed.expiresAt
      current.xuid = refreshed.xuid
      current.msClientId = refreshed.msClientId
      current.name = refreshed.name
      current.uuid = refreshed.uuid
      current.avatarUrl = refreshed.avatarUrl
      await store.updateAccount(current)
    }
    return store.findAccountById(accountId) || refreshed
  }
}

export const microsoftAuth = new MicrosoftAuthService()
