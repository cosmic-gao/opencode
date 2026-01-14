import { spawn } from 'node:child_process'

import type { Plugin } from '@opencode/plugable'

import type { KernelContext, RunContext, RunResponse } from './types.ts'
import type { OvermindHooks } from './kernel.ts'

function parseJson(text: string): unknown | undefined {
  const value = text.trim()
  if (!value) return undefined
  try {
    return JSON.parse(value) as unknown
  } catch {
    return undefined
  }
}

export const RunPlugin: Plugin<OvermindHooks, KernelContext> = {
  name: 'overmind:run',
  setup(api) {
    api.onRun.tap(async (context) => {
      const child = spawn('bun', [context.agent.entryPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: process.env,
      })

      child.stdin.write(context.inputText)
      child.stdin.end()

      const out: Buffer[] = []
      const err: Buffer[] = []

      child.stdout.on('data', (chunk) => out.push(chunk as Buffer))
      child.stderr.on('data', (chunk) => err.push(chunk as Buffer))

      const code = await new Promise<number>((resolve) => {
        child.on('close', (value) => resolve(value ?? 0))
      })

      const text = Buffer.concat(out).toString('utf8')
      const errorText = Buffer.concat(err).toString('utf8').trim()
      const data = parseJson(text)

      const response: RunResponse =
        code !== 0
          ? { success: false, text, data, error: errorText || `Exit ${code}` }
          : { success: true, text, data, error: errorText || undefined }

      const next: RunContext = { ...context, response }
      return next
    })
  },
}
