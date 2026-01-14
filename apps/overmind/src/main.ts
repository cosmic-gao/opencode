import * as path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { createKernel } from './kernel'
import { serve } from './serve'
import { parseChat } from './chat'
import { parseTask } from './task'

function readText(): Promise<string> {
  return new Promise((resolve) => {
    const list: Buffer[] = []
    process.stdin.on('data', (chunk) => list.push(chunk as Buffer))
    process.stdin.on('end', () => resolve(Buffer.concat(list).toString('utf8')))
    process.stdin.resume()
  })
}

function findValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name)
  if (index < 0) return undefined
  return args[index + 1]
}

function rootPath(filePath: string): string {
  return path.resolve(path.dirname(filePath), '../../..')
}

function findIntent(messages: { role: string; text: string }[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const item = messages[index]
    if (!item) continue
    if (item.role === 'user' && item.text.length > 0) return item.text
  }
  return messages.map((item) => item.text).join('\n')
}

async function main(): Promise<void> {
  const filePath = fileURLToPath(import.meta.url)
  const args = process.argv.slice(2)
  const command = args[0]

  const kernel = await createKernel({ rootPath: rootPath(filePath) })

  if (command === 'list') {
    const agentList = await kernel.list()
    process.stdout.write(JSON.stringify(agentList, null, 2) + '\n')
    return
  }

  if (command === 'run') {
    const name = args[1]
    if (!name) {
      process.stderr.write('Missing agent name\n')
      process.exitCode = 1
      return
    }

    const json = findValue(args, '--json')
    const inputText = json ?? (await readText())
    const result = await kernel.run(name, inputText || 'null')
    process.stdout.write(JSON.stringify(result, null, 2) + '\n')
    process.exitCode = result.success ? 0 : 1
    return
  }

  if (command === 'task') {
    const json = findValue(args, '--json')
    const inputText = json ?? (await readText())
    const data = JSON.parse(inputText || 'null') as unknown
    const request = parseTask(data)
    if (!request) {
      process.stdout.write(JSON.stringify({ success: false, error: 'Invalid request' }, null, 2) + '\n')
      process.exitCode = 1
      return
    }
    const result = await kernel.task(request)
    process.stdout.write(JSON.stringify(result, null, 2) + '\n')
    process.exitCode = result.success ? 0 : 1
    return
  }

  if (command === 'chat') {
    const json = findValue(args, '--json')
    const inputText = json ?? (await readText())
    const data = JSON.parse(inputText || 'null') as unknown
    const chat = parseChat(data)
    if (!chat) {
      process.stdout.write(JSON.stringify({ success: false, error: 'Invalid request' }, null, 2) + '\n')
      process.exitCode = 1
      return
    }

    const requestId = chat.requestId ?? randomUUID()
    const request = {
      requestId,
      taskType: 'chat',
      userIntent: findIntent(chat.messages),
      context: { messages: chat.messages, limit: chat.limit },
      keyName: chat.keyName,
      provider: chat.provider,
      model: chat.model,
    }

    const result = await kernel.task(request)
    process.stdout.write(JSON.stringify(result, null, 2) + '\n')
    process.exitCode = result.success ? 0 : 1
    return
  }

  if (command === 'serve') {
    const portText = findValue(args, '--port')
    const port = portText ? Number(portText) : 8787
    serve({ kernel, port: Number.isFinite(port) ? port : 8787 })
    return
  }

  process.stderr.write('Usage: overmind list | overmind run <name> [--json <json>] | overmind task [--json <json>] | overmind chat [--json <json>] | overmind serve [--port <number>]\n')
  process.exitCode = 1
}

await main()
