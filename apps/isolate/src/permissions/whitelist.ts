/**
 * Environment variable whitelist module
 * Applies pattern-based filtering to environment variables
 */

import { match } from '../common/matcher.ts';

/**
 * Filter environment variables by whitelist patterns
 */
export function filter(
  variables: Record<string, unknown>,
  patterns: string[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(variables)) {
    if (match(key, patterns)) {
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * Filter environment variable keys by whitelist patterns
 */
export function keys(
  variables: string[],
  patterns: string[],
): string[] {
  return variables.filter(key => match(key, patterns));
}

/**
 * Check if a key is allowed by whitelist patterns
 */
export function allow(key: string, patterns: string[]): boolean {
  return match(key, patterns);
}

