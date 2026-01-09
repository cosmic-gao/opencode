import type { Tool } from '../types.ts';
import { registry } from '../tools/index.ts';

export function create(name: string, config?: unknown): Tool | undefined {
  const builder = registry[name];
  return builder?.(config);
}

export function index(configs?: Record<string, unknown>): Record<string, Tool> {
  const tools: Record<string, Tool> = {};

  for (const name in registry) {
    const tool = create(name, configs?.[name]);
    if (tool) {
      tools[name] = tool;
    }
  }

  return tools;
}

export function resolve(
  names: string[],
  defaults: Record<string, Tool>,
  configs?: Map<string, unknown>,
): Tool[] {
  if (!configs || configs.size === 0) {
    return names.map((name) => defaults[name]).filter(Boolean);
  }

  return names.map((name) => {
    if (configs.has(name)) {
      return create(name, configs.get(name)) ?? defaults[name];
    }
    return defaults[name];
  }).filter(Boolean);
}
