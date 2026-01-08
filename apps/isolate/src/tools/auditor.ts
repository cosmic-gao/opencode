/**
 * Database operation auditor
 * Tracks and logs database operations for security monitoring
 */

import type { Entry } from '../types.ts';

export type Operation = 'select' | 'insert' | 'update' | 'delete';

export interface Record {
  readonly operation: Operation;
  readonly table: string;
  readonly timestamp: number;
  readonly duration?: number;
}

export interface Options {
  readonly enabled: boolean;
  readonly console?: boolean;
}

/**
 * Auditor tracks database operations
 */
export class Auditor {
  private records: Record[] = [];
  private readonly limit = 1000;
  private readonly options: Options;

  constructor(options: Options = { enabled: false }) {
    this.options = options;
  }

  /**
   * Record a database operation
   */
  record(operation: Operation, table: string, duration?: number): void {
    if (!this.options.enabled) return;

    const record: Record = {
      operation,
      table,
      timestamp: Date.now(),
      duration,
    };

    this.records.push(record);

    // Prevent memory leak
    if (this.records.length > this.limit) {
      this.records.shift();
    }

    if (this.options.console) {
      const message = duration
        ? `[Audit] ${operation.toUpperCase()} ${table} (${duration}ms)`
        : `[Audit] ${operation.toUpperCase()} ${table}`;
      console.log(message);
    }
  }

  /**
   * Get all audit records
   */
  list(): readonly Record[] {
    return this.records;
  }

  /**
   * Clear all audit records
   */
  clear(): void {
    this.records = [];
  }

  /**
   * Convert audit records to log entries
   */
  entries(): Entry[] {
    return this.records.map(record => ({
      level: 'info' as const,
      message: `${record.operation.toUpperCase()} ${record.table}${
        record.duration ? ` (${record.duration}ms)` : ''
      }`,
      timestamp: record.timestamp,
    }));
  }
}

/**
 * Wrap a function with audit tracking
 */
export function wrap<T extends (...args: unknown[]) => unknown>(
  fn: T,
  auditor: Auditor,
  operation: Operation,
  table: string,
): T {
  return ((...args: unknown[]) => {
    const start = performance.now();
    const result = fn(...args);

    if (result instanceof Promise) {
      return result.finally(() => {
        const duration = Math.round(performance.now() - start);
        auditor.record(operation, table, duration);
      });
    } else {
      const duration = Math.round(performance.now() - start);
      auditor.record(operation, table, duration);
      return result;
    }
  }) as T;
}

