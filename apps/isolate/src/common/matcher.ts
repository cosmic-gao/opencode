/**
 * Pattern matching utilities
 * Core module for wildcard and exact pattern matching
 */

export interface Pattern {
  readonly value: string;
  readonly wildcard: boolean;
}

/**
 * Parse a pattern string into structured format
 */
export function parse(pattern: string): Pattern {
  return {
    value: pattern.endsWith('*') ? pattern.slice(0, -1) : pattern,
    wildcard: pattern.endsWith('*'),
  };
}

/**
 * Test if a string matches a single pattern
 */
export function test(target: string, pattern: Pattern): boolean {
  return pattern.wildcard
    ? target.startsWith(pattern.value)
    : target === pattern.value;
}

/**
 * Test if a string matches any pattern in a list
 */
export function match(target: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (test(target, parse(pattern))) {
      return true;
    }
  }
  return false;
}

/**
 * Filter an array of strings by patterns
 */
export function filter<T extends string>(
  items: T[],
  patterns: string[],
): T[] {
  return items.filter(item => match(item, patterns));
}

