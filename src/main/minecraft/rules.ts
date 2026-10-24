import type { Rule } from './types'

export interface RuleContext {
  osName: 'windows' | 'osx' | 'linux'
  arch: string
  osVersion: string
  features: Record<string, boolean>
}

export function currentRuleContext(features: Record<string, boolean> = {}): RuleContext {
  const release = process.getSystemVersion?.() || ''
  return {
    osName: process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'osx' : 'linux',
    arch: process.arch,
    osVersion: release,
    features
  }
}

export function rulesAllow(rules: Rule[] | undefined, context: RuleContext): boolean {
  if (!rules || rules.length === 0) return true
  let allowed = false
  for (const rule of rules) {
    let matches = true
    if (rule.os) {
      if (rule.os.name && rule.os.name !== context.osName) matches = false
      if (rule.os.arch) {
        const normalizedArch = rule.os.arch === 'x86' ? 'ia32' : rule.os.arch
        if (normalizedArch !== context.arch) matches = false
      }
      if (rule.os.version) {
        try {
          if (!new RegExp(rule.os.version).test(context.osVersion)) matches = false
        } catch {
          matches = false
        }
      }
    }
    if (rule.features) {
      for (const [name, expected] of Object.entries(rule.features)) {
        if (Boolean(context.features[name]) !== Boolean(expected)) matches = false
      }
    }
    if (matches) allowed = rule.action === 'allow'
  }
  return allowed
}

export function expandArguments(
  values: Array<string | { rules?: Rule[]; value: string | string[] }> | undefined,
  context: RuleContext
): string[] {
  if (!values) return []
  const result: string[] = []
  for (const entry of values) {
    if (typeof entry === 'string') {
      result.push(entry)
      continue
    }
    if (rulesAllow(entry.rules, context)) {
      if (Array.isArray(entry.value)) result.push(...entry.value)
      else if (typeof entry.value === 'string') result.push(entry.value)
    }
  }
  return result
}

export function splitCommandLine(input: string): string[] {
  const result: string[] = []
  let current = ''
  let quote: string | null = null
  let escaped = false
  for (const char of input) {
    if (escaped) {
      current += char
      escaped = false
      continue
    }
    if (char === '\\' && quote) {
      escaped = true
      continue
    }
    if (quote) {
      if (char === quote) quote = null
      else current += char
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (/\s/.test(char)) {
      if (current) {
        result.push(current)
        current = ''
      }
    } else {
      current += char
    }
  }
  if (current) result.push(current)
  return result
}
