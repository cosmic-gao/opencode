export type TaskRequest = {
  requestId: string
  taskType: string
  userIntent: string
  context: Record<string, unknown>
  constraints?: Record<string, unknown>
  provider?: string
  model?: string
  keyName?: string
}

export type Plan = {
  agent: string
  input: unknown
  reason?: string
}

export type TaskResponse = {
  requestId: string
  success: boolean
  plan?: Plan
  agent?: {
    name: string
    success: boolean
    data?: unknown
    text: string
    error?: string
  }
  model?: {
    provider: string
    model: string
    usage?: unknown
  }
  error?: string
}

export type TaskContext = {
  request: TaskRequest
  promptText?: string
  messages?: unknown
  modelText?: string
  modelInfo?: TaskResponse['model']
  plan?: Plan
  response?: TaskResponse
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

export function parseTask(value: unknown): TaskRequest | null {
  if (!isRecord(value)) return null
  if (typeof value.requestId !== 'string') return null
  if (typeof value.taskType !== 'string') return null
  if (typeof value.userIntent !== 'string') return null
  if (!isRecord(value.context)) return null

  const request: TaskRequest = {
    requestId: value.requestId,
    taskType: value.taskType,
    userIntent: value.userIntent,
    context: value.context,
    constraints: isRecord(value.constraints) ? (value.constraints as Record<string, unknown>) : undefined,
    provider: typeof value.provider === 'string' ? value.provider : undefined,
    model: typeof value.model === 'string' ? value.model : undefined,
    keyName: typeof value.keyName === 'string' ? value.keyName : undefined,
  }
  return request
}
