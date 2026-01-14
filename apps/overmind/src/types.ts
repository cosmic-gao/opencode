export type AgentSpec = {
  name: string
  dirPath: string
  entryPath: string
  description?: string
}

export type KernelContext = {
  rootPath: string
  agentList: AgentSpec[]
}

export type RunContext = {
  agent: AgentSpec
  inputText: string
  response?: RunResponse
}

export type RunResponse = {
  success: boolean
  text: string
  data?: unknown
  error?: string
}
