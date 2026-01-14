import type { Plan } from './task'

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

export type CheckResult = {
  success: boolean
  plan?: Plan
  error?: string
}

export function parsePlan(text: string): CheckResult {
  const value = text.trim()
  if (!value) return { success: false, error: 'Empty model output' }

  let json: unknown
  try {
    json = JSON.parse(value) as unknown
  } catch {
    return { success: false, error: 'Model output is not JSON' }
  }

  if (!isRecord(json)) return { success: false, error: 'Model output is not object' }
  if (!isText(json.agent)) return { success: false, error: 'Missing plan.agent' }

  const reason = isText(json.reason) ? json.reason : undefined
  const plan: Plan = { agent: json.agent, input: json.input, reason }
  return { success: true, plan }
}

