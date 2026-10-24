import { appendFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'

let logFile = ''

async function ensureLogFile(): Promise<string> {
  if (!logFile) {
    const dir = join(app.getPath('userData'), 'logs')
    await mkdir(dir, { recursive: true })
    logFile = join(dir, 'launcher.log')
  }
  return logFile
}

function write(level: string, message: string): void {
  const line = `[${new Date().toISOString()}] [${level}] ${message}\n`
  if (level === 'ERROR') console.error(line.trimEnd())
  else console.log(line.trimEnd())
  void ensureLogFile()
    .then((file) => appendFile(file, line))
    .catch(() => undefined)
}

export const logger = {
  info: (message: string) => write('INFO', message),
  warn: (message: string) => write('WARN', message),
  error: (message: string) => write('ERROR', message),
  debug: (message: string) => write('DEBUG', message)
}
