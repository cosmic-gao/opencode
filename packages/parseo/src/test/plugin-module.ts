import type { SemanticPlugin } from '../semantic/plugin'

export const plugin: SemanticPlugin<string, unknown> = {
  name: 'plugin-module',
  supports: () => true,
  run: () => 'ok',
}

export const plugins = [plugin]

