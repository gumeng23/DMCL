import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { NewsItem } from '../shared/types'
import { cacheDir } from './paths'
import { getJson } from './http'

interface RawNews {
  entries?: Array<{
    id?: string
    title?: string
    category?: string
    date?: string
    text?: string
    playPageImage?: { url?: string }
    newsPageImage?: { url?: string }
    readMoreLink?: string
    newsType?: string[]
  }>
}

const NEWS_URL = 'https://launchercontent.mojang.com/v2/news.json'
const BASE = 'https://launchercontent.mojang.com'

function cacheFile(): string {
  return join(cacheDir(), 'news.json')
}

function mapNews(raw: RawNews): NewsItem[] {
  const entries = raw.entries || []
  return entries
    .filter((entry) => entry.title && entry.readMoreLink)
    .map((entry) => ({
      id: entry.id || entry.title || Math.random().toString(36),
      title: (entry.title || '').trim(),
      category: entry.category || 'Minecraft',
      date: entry.date || '',
      text: (entry.text || '').trim(),
      image: entry.newsPageImage?.url ? `${BASE}${entry.newsPageImage.url}` : entry.playPageImage?.url ? `${BASE}${entry.playPageImage.url}` : '',
      url: entry.readMoreLink || 'https://www.minecraft.net/',
      java: (entry.newsType || []).includes('Java') || /java/i.test(entry.category || '')
    }))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 12)
}

export async function fetchNews(): Promise<NewsItem[]> {
  const file = cacheFile()
  try {
    const raw = await getJson<RawNews>(NEWS_URL, { timeoutMs: 20_000, retries: 1 })
    const mapped = mapNews(raw)
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, JSON.stringify(mapped), 'utf8')
    return mapped
  } catch {
    try {
      const info = await stat(file)
      if (Date.now() - info.mtimeMs < 1000 * 60 * 60 * 24 * 7) {
        return JSON.parse(await readFile(file, 'utf8')) as NewsItem[]
      }
    } catch {
      // Ignore.
    }
    return []
  }
}
