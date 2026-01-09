import type { Tool, InternalAPI } from '../types.ts';
import { provide } from './inject.ts';

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
  tools: Tool[],
  data: Record<string, unknown> = {},
  internal?: InternalAPI,
): Promise<void> {
  if (Object.keys(data).length > 0) {
    provide(scope, data);
  }

  await install(scope, tools, internal);
}
