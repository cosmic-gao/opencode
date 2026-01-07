import type { Tool, Registry } from '../types.ts';
import { provide } from './inject.ts';

export function registry(items: Tool[]): Registry {
  const result: Registry = {};
  for (const tool of items) {
    result[tool.name] = tool;
  }
  return result;
}

export function setup(items: Tool[], globals: Record<string, unknown>): void {
  for (const tool of items) {
    tool.setup(globals);
  }
}

export async function install(scope: Record<string, unknown>, tools: Tool[]): Promise<string[]> {
  const installed: string[] = [];
  try {
    for (const tool of tools) {
      await tool.setup(scope);
      installed.push(tool.name);
    }
    return installed;
  } catch (error) {
    for (const name of installed) {
      try {
        delete scope[name];
      } catch {
        // ignore
      }
    }
    throw error;
  }
}

export async function bootstrap(
  scope: Record<string, unknown>,
  items: Tool[],
  names: string[] = [],
  globals: Record<string, unknown> = {},
): Promise<void> {
  const index = registry(items);
  const selected: Tool[] = [];

  for (const name of names) {
    const tool = index[name];
    if (tool) {
      selected.push(tool);
    }
  }

  await install(scope, selected);

  if (Object.keys(globals).length > 0) {
    provide(scope, globals);
  }
}
