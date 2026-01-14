import type { ChatRequest, ChatResponse, Provider } from './types'

export type ClientOptions = {
  provider: Provider
}

export class Client {
  private provider: Provider

  constructor(options: ClientOptions) {
    this.provider = options.provider
  }

  chat(request: ChatRequest): Promise<ChatResponse> {
    return this.provider.chat(request)
  }
}

