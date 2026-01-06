import type { IsolatePlugin, Entry, Level, Output, Logger } from '../types.ts'
import type { APIHook } from '@opencode/plugable'
import { createAPIHook } from '@opencode/plugable'

interface FilterOptions {
  minLevel?: Level
  maxEntries?: number
}

const LEVELS: Record<Level, number> = {
  log: 0,
  info: 1,
  warn: 2,
  error: 3,
  exception: 4,
}

function filter(logs: readonly Entry[], options: FilterOptions = {}): Entry[] {
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

const factory: Logger = {
  filter,
}

export const LoggerPlugin: IsolatePlugin = {
  name: 'opencode:logger',
  pre: [],
  post: [],
  required: [],
  usePlugins: [],
  registryHook: {
    onLogger: createAPIHook<Logger>(),
  },

  setup(api) {
    if (!api.onLogger) {
      throw new Error('onLogger not registered')
    }

    (api.onLogger as APIHook<Logger>).provide(factory)

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
