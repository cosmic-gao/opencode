import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createKernel } from './kernel'

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

  process.stderr.write('Usage: overmind list | overmind run <name> [--json <json>]\n')
  process.exitCode = 1
}

await main()

