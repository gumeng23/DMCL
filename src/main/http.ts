import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, rename, rm, stat } from 'node:fs/promises'
import http from 'node:http'
import https from 'node:https'
import { dirname } from 'node:path'
import { pipeline } from 'node:stream/promises'
import type { DownloadSource } from '../shared/types'

const USER_AGENT = 'AMCL-Launcher/1.0.0 (Windows NT 10.0; Win64; x64)'
const MAX_REDIRECTS = 8
const agent = new https.Agent({ keepAlive: true, maxSockets: 24, family: 4 })

export interface RequestOptions {
  signal?: AbortSignal
  timeoutMs?: number
  headers?: Record<string, string>
}

export interface DownloadOptions extends RequestOptions {
  sha1?: string
  size?: number
  onProgress?: (received: number, total: number) => void
  retries?: number
  verifyHash?: boolean
  skipIfExists?: boolean
}

export class HttpError extends Error {
  status: number
  url: string
  constructor(status: number, url: string, message?: string) {
    super(message || `HTTP ${status} · ${url}`)
    this.name = 'HttpError'
    this.status = status
    this.url = url
  }
}

function requestOnce(url: string, options: RequestOptions, redirects = 0): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    let target: URL
    try {
      target = new URL(url)
    } catch {
      reject(new Error(`无效地址：${url}`))
      return
    }
    const transport = target.protocol === 'http:' ? http : https
    const req = transport.request(
      target,
      {
        method: 'GET',
        agent: target.protocol === 'https:' ? agent : undefined,
        family: 4,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: '*/*',
          ...options.headers
        },
        signal: options.signal,
        timeout: options.timeoutMs ?? 30_000
      },
      (res) => {
        const status = res.statusCode ?? 0
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume()
          if (redirects >= MAX_REDIRECTS) {
            reject(new Error('重定向次数过多'))
            return
          }
          const next = new URL(res.headers.location, target).toString()
          resolve(requestOnce(next, options, redirects + 1))
          return
        }
        if (status < 200 || status >= 300) {
          res.resume()
          reject(new HttpError(status, url))
          return
        }
        resolve(res)
      }
    )
    req.on('timeout', () => req.destroy(new Error('网络请求超时')))
    req.on('error', (error) => reject(error))
    req.end()
  })
}

async function wait(ms: number, signal?: AbortSignal): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true }
    )
  })
}

export async function postForm<T>(
  url: string,
  fields: Record<string, string>,
  options: RequestOptions = {}
): Promise<{ status: number; data: T }> {
  const body = new URLSearchParams(fields).toString()
  return postRaw<T>(url, body, 'application/x-www-form-urlencoded', options)
}

export async function postJson<T>(
  url: string,
  payload: unknown,
  options: RequestOptions = {}
): Promise<{ status: number; data: T }> {
  const body = JSON.stringify(payload)
  return postRaw<T>(url, body, 'application/json', options)
}

async function postRaw<T>(
  url: string,
  body: string,
  contentType: string,
  options: RequestOptions = {},
  redirects = 0
): Promise<{ status: number; data: T }> {
  const target = new URL(url)
  const transport = target.protocol === 'http:' ? http : https
  return await new Promise((resolve, reject) => {
    const req = transport.request(
      target,
      {
        method: 'POST',
        agent: target.protocol === 'https:' ? agent : undefined,
        family: 4,
        headers: {
          'User-Agent': USER_AGENT,
          'Content-Type': contentType,
          'Content-Length': Buffer.byteLength(body),
          ...options.headers
        },
        signal: options.signal,
        timeout: options.timeoutMs ?? 30_000
      },
      (res) => {
        const status = res.statusCode ?? 0
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume()
          if (redirects >= MAX_REDIRECTS) {
            reject(new Error('重定向次数过多'))
            return
          }
          resolve(
            postRaw<T>(
              new URL(res.headers.location, target).toString(),
              body,
              contentType,
              options,
              redirects + 1
            )
          )
          return
        }
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          try {
            resolve({ status, data: (text ? JSON.parse(text) : {}) as T })
          } catch {
            reject(new Error(`服务器返回了无效数据 (${status})`))
          }
        })
      }
    )
    req.on('timeout', () => req.destroy(new Error('网络请求超时')))
    req.on('error', reject)
    req.end(body)
  })
}

export async function getJson<T>(url: string, options: RequestOptions & { retries?: number } = {}): Promise<T> {
  const retries = options.retries ?? 3
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await requestOnce(url, options)
      const chunks: Buffer[] = []
      let bytes = 0
      for await (const chunk of res) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        bytes += buffer.length
        if (bytes > 40 * 1024 * 1024) throw new Error('服务器响应过大')
        chunks.push(buffer)
      }
      const text = Buffer.concat(chunks).toString('utf8')
      try {
        return JSON.parse(text) as T
      } catch {
        throw new Error(`服务器返回了无效数据：${url}`)
      }
    } catch (error) {
      lastError = error
      if (options.signal?.aborted) throw error
      if (error instanceof HttpError && error.status < 500 && error.status !== 429) throw error
      if (attempt < retries) await wait(500 * (attempt + 1), options.signal)
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

export async function getBuffer(url: string, options: RequestOptions = {}): Promise<Buffer> {
  const res = await requestOnce(url, options)
  const chunks: Buffer[] = []
  for await (const chunk of res) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

async function sha1File(file: string): Promise<string> {
  return await new Promise((resolve, reject) => {
    const hash = createHash('sha1')
    const stream = createReadStream(file)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

async function validExistingFile(file: string, options: DownloadOptions): Promise<boolean> {
  try {
    const info = await stat(file)
    if (info.size === 0) return false
    if (options.size && info.size !== options.size) return false
    if (options.sha1 && options.verifyHash !== false) {
      return (await sha1File(file)).toLowerCase() === options.sha1.toLowerCase()
    }
    return true
  } catch {
    return false
  }
}

export async function downloadFile(
  url: string,
  destination: string,
  options: DownloadOptions = {}
): Promise<{ bytes: number; skipped: boolean }> {
  if (options.skipIfExists !== false && (await validExistingFile(destination, options))) {
    const info = await stat(destination)
    options.onProgress?.(info.size, info.size)
    return { bytes: info.size, skipped: true }
  }

  await mkdir(dirname(destination), { recursive: true })
  const retries = options.retries ?? 3
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt++) {
    const temp = `${destination}.part-${process.pid}-${Date.now()}`
    try {
      const res = await requestOnce(url, options)
      const total = Number(res.headers['content-length'] || options.size || 0)
      let received = 0
      let lastReport = 0
      res.on('data', (chunk: Buffer) => {
        received += chunk.length
        const now = Date.now()
        if (now - lastReport > 100) {
          lastReport = now
          options.onProgress?.(received, total)
        }
      })
      await pipeline(res, createWriteStream(temp))
      if (total > 0 && received !== total) throw new Error('下载不完整，正在重试…')
      if (options.size && received !== options.size) throw new Error('文件大小校验失败')
      if (options.sha1 && options.verifyHash !== false) {
        const actual = await sha1File(temp)
        if (actual.toLowerCase() !== options.sha1.toLowerCase()) {
          throw new Error('文件校验失败，请重试')
        }
      }
      await rename(temp, destination)
      options.onProgress?.(received, total || received)
      return { bytes: received, skipped: false }
    } catch (error) {
      lastError = error
      await rm(temp, { force: true }).catch(() => undefined)
      if (options.signal?.aborted) throw error
      if (error instanceof HttpError && error.status === 404) throw error
      if (attempt < retries) await wait(400 * (attempt + 1), options.signal)
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

export async function downloadMany<T>(
  items: T[],
  limit: number,
  signal: AbortSignal | undefined,
  worker: (item: T, index: number) => Promise<void>,
  onTick?: (done: number, total: number) => void
): Promise<void> {
  let next = 0
  let done = 0
  let firstError: unknown = null
  const concurrency = Math.max(1, Math.min(limit, items.length || 1))

  const run = async (): Promise<void> => {
    while (true) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      if (firstError) return
      const index = next++
      if (index >= items.length) return
      try {
        await worker(items[index], index)
        done++
        onTick?.(done, items.length)
      } catch (error) {
        firstError = error
        return
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => run()))
  if (firstError) throw firstError
}

export function mirrorUrl(url: string, source: DownloadSource): string {
  if (source === 'official' || source === 'auto' || !url) return url
  const replacements: Array<[string, string]> = [
    ['https://piston-meta.mojang.com', 'https://bmclapi2.bangbang93.com'],
    ['https://launchermeta.mojang.com', 'https://bmclapi2.bangbang93.com'],
    ['https://launcher.mojang.com', 'https://bmclapi2.bangbang93.com'],
    ['https://libraries.minecraft.net', 'https://bmclapi2.bangbang93.com/maven'],
    ['https://maven.minecraftforge.net', 'https://bmclapi2.bangbang93.com/maven'],
    ['https://resources.download.minecraft.net', 'https://bmclapi2.bangbang93.com/assets'],
    ['https://files.minecraftforge.net', 'https://bmclapi2.bangbang93.com']
  ]
  for (const [from, to] of replacements) {
    if (url.startsWith(from)) return url.replace(from, to)
  }
  return url
}

export function sourceCandidates(url: string, source: DownloadSource): string[] {
  if (source === 'bmclapi') return [mirrorUrl(url, 'bmclapi')]
  if (source === 'official') return [url]
  return [url, mirrorUrl(url, 'bmclapi')].filter((value, index, all) => value && all.indexOf(value) === index)
}

export async function downloadWithFallback(
  url: string,
  destination: string,
  source: DownloadSource,
  options: DownloadOptions = {}
): Promise<{ bytes: number; skipped: boolean; url: string }> {
  const candidates = sourceCandidates(url, source)
  let lastError: unknown
  for (const candidate of candidates) {
    try {
      const result = await downloadFile(candidate, destination, options)
      return { ...result, url: candidate }
    } catch (error) {
      lastError = error
      if (options.signal?.aborted) throw error
      if (error instanceof HttpError && error.status === 404) continue
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

export async function getJsonWithFallback<T>(
  url: string,
  source: DownloadSource,
  options: RequestOptions & { retries?: number } = {}
): Promise<T> {
  let lastError: unknown
  for (const candidate of sourceCandidates(url, source)) {
    try {
      return await getJson<T>(candidate, options)
    } catch (error) {
      lastError = error
      if (options.signal?.aborted) throw error
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}
