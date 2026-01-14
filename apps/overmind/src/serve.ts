import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'

import type { Kernel } from './kernel'
import { parseChat } from './chat'
import { parseTask } from './task'

export type ServeOptions = {
  kernel: Kernel
  port: number
}

function readText(request: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const list: Buffer[] = []
    request.on('data', (chunk) => list.push(chunk as Buffer))
    request.on('end', () => resolve(Buffer.concat(list).toString('utf8')))
    request.on('error', reject)
  })
}

function writeJson(response: import('node:http').ServerResponse, code: number, data: unknown): void {
  const text = JSON.stringify(data)
  response.statusCode = code
  response.setHeader('content-type', 'application/json')
  response.end(text)
}

function parseJson(text: string): unknown {
  const value = text.trim()
  if (!value) return null
  return JSON.parse(value) as unknown
}

function findIntent(messages: { role: string; text: string }[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const item = messages[index]
    if (!item) continue
    if (item.role === 'user' && item.text.length > 0) return item.text
  }
  return messages.map((item) => item.text).join('\n')
}

export function serve(options: ServeOptions): void {
  const server = createServer(async (request, response) => {
    const url = request.url ?? '/'
    const method = request.method ?? 'GET'

    if (url === '/health') {
      writeJson(response, 200, { ok: true })
      return
    }

    if (url === '/task' && method === 'POST') {
      try {
        const text = await readText(request)
        const data = parseJson(text)
        const task = parseTask(data)
        if (!task) {
          writeJson(response, 400, { success: false, error: 'Invalid request' })
          return
        }

        const result = await options.kernel.task(task)
        writeJson(response, result.success ? 200 : 400, result)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        writeJson(response, 500, { success: false, error: message })
      }
      return
    }

    if (url === '/chat' && method === 'POST') {
      try {
        const text = await readText(request)
        const data = parseJson(text)
        const chat = parseChat(data)
        if (!chat) {
          writeJson(response, 400, { success: false, error: 'Invalid request' })
          return
        }

        const requestId = chat.requestId ?? randomUUID()
        const task = {
          requestId,
          taskType: 'chat',
          userIntent: findIntent(chat.messages),
          context: { messages: chat.messages, limit: chat.limit },
          keyName: chat.keyName,
          provider: chat.provider,
          model: chat.model,
        }

        const result = await options.kernel.task(task)
        writeJson(response, result.success ? 200 : 400, result)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        writeJson(response, 500, { success: false, error: message })
      }
      return
    }

    writeJson(response, 404, { success: false, error: 'Not found' })
  })

  server.listen(options.port, () => {
    const address = server.address()
    if (address && typeof address === 'object') process.stdout.write(`overmind listening on http://localhost:${address.port}/\n`)
  })
}
