import type { ModelBuilder } from '../model/builder'

export const builder: ModelBuilder = {
  name: 'builder-module',
  supports: (node) => node.kind === 'module',
  build: (node, document) => {
    document.entities.push({ type: 'module', name: node.name ?? 'Module' })
  },
}

export const builders = [builder]

