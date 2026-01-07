import type { Tool, Registry, InternalAPI } from '../types.ts';
import { provide } from './inject.ts';

export function index(items: Tool[]): Registry {
  const result: Registry = {};
  for (const tool of items) {
    result[tool.name] = tool;
  }
  return result;
}

export function setup(items: Tool[], scope: Record<string, unknown>, internal?: InternalAPI): void {
  for (const tool of items) {
    tool.setup(scope, internal);
  }
}

export async function install(scope: Record<string, unknown>, tools: Tool[], internal?: InternalAPI): Promise<string[]> {
  const installed: string[] = [];
  try {
    for (const tool of tools) {
      await tool.setup(scope, internal);
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

export async function unmount(scope: Record<string, unknown>, tools: Tool[]): Promise<void> {
  for (const tool of tools) {
    if (tool.teardown) {
      try {
        await tool.teardown(scope);
      } catch (error) {
        console.error(`Teardown failed [${tool.name}]:`, error);
      }
    }
  }
}

export async function mount(
  scope: Record<string, unknown>,
  items: Tool[],
  names: string[] = [],
  data: Record<string, unknown> = {},
  internal?: InternalAPI,
): Promise<void> {
  const registry = index(items);
  const selected: Tool[] = [];

  for (const name of names) {
    const tool = registry[name];
    if (tool) {
      selected.push(tool);
    }
  }

  if (Object.keys(data).length > 0) {
    provide(scope, data);
  }

  await install(scope, selected, internal);
}
