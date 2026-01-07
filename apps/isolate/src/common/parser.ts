import type { ToolSpec } from '../types.ts';

export interface ParsedSpec {
  name: string;
  config?: unknown;
}

export function parse(specs: ToolSpec[]): ParsedSpec[] {
  const results: ParsedSpec[] = [];

  for (const spec of specs) {
    if (typeof spec === 'string') {
      results.push({ name: spec });
    } else if (Array.isArray(spec) && spec.length >= 1) {
      const [name, config] = spec;
      results.push({ name, config });
    }
  }

  return results;
}

export function extract(specs: ToolSpec[], registry: Record<string, unknown>): {
  names: string[];
  configs: Map<string, unknown>;
} {
  const names: string[] = [];
  const configs = new Map<string, unknown>();

  for (const parsed of parse(specs)) {
    if (parsed.name in registry) {
      names.push(parsed.name);
      if (parsed.config !== undefined) {
        configs.set(parsed.name, parsed.config);
      }
    }
  }

  return { names, configs };
}
