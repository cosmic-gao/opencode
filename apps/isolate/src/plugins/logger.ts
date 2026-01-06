import type { IsolatePlugin, LogEntry, LogLevel, Output, LoggerFactory } from '../types.ts'
import type { APIHook } from '@opencode/plugable'
import { createAPIHook } from '@opencode/plugable'

interface FilterOptions {
  minLevel?: LogLevel
  maxEntries?: number
}

const LEVELS: Record<LogLevel, number> = {
  log: 0,
  info: 1,
  warn: 2,
  error: 3,
  exception: 4,
}

function filter(logs: readonly LogEntry[], options: FilterOptions = {}): LogEntry[] {
  let result = [...logs]

  if (options.minLevel) {
    const min = LEVELS[options.minLevel]
    result = result.filter((log) => LEVELS[log.level] >= min)
  }

  if (options.maxEntries && result.length > options.maxEntries) {
    result = result.slice(-options.maxEntries)
  }

  return result
}

const factory: LoggerFactory = {
  filter,
}

export const LoggerPlugin: IsolatePlugin = {
  name: 'opencode:logger',
  pre: [],
  post: [],
  required: [],
  usePlugins: [],
  registryHook: {
    onLogger: createAPIHook<LoggerFactory>(),
  },

  setup(api) {
    if (!api.onLogger) {
      throw new Error('onLogger not registered')
    }

    (api.onLogger as APIHook<LoggerFactory>).provide(factory)

    api.onFormat.tap((output: Output) => {
      if (output.logs && output.logs.length > 0) {
        const filtered = filter(output.logs, {
          maxEntries: 1000,
        })

        return {
          ...output,
          logs: filtered,
        }
      }

      return output
    })
  },
}

export { filter }
