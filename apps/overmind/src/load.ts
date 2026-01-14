import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import type { AgentSpec } from './types.ts'

type AgentJson = {
  name?: unknown
  description?: unknown
  entry?: unknown
}

type PackageJson = {
  name?: unknown
  description?: unknown
}

async function readJson(filePath: string): Promise<unknown> {
  const text = await fs.readFile(filePath, 'utf8')
  return JSON.parse(text) as unknown
}

function toText(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

export async function loadSpec(dirPath: string): Promise<AgentSpec | null> {
  const agentPath = path.join(dirPath, 'agent.json')
  const packPath = path.join(dirPath, 'package.json')

  try {
    const raw = (await readJson(agentPath)) as AgentJson
    const name = toText(raw.name) ?? path.basename(dirPath)
    const entry = toText(raw.entry) ?? 'src/main.ts'
    const entryPath = path.join(dirPath, entry)
    const description = toText(raw.description)
    return { name, dirPath, entryPath, description }
  } catch {}

  try {
    const raw = (await readJson(packPath)) as PackageJson
    const name = toText(raw.name) ?? path.basename(dirPath)
    const entryPath = path.join(dirPath, 'src/main.ts')
    const description = toText(raw.description)
    return { name, dirPath, entryPath, description }
  } catch {}

  return null
}

