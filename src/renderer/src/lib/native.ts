export const api = window.amc

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
  }
  const text = String(error)
  return text.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}
