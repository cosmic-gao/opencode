export interface AuditorConfig {
  enabled?: boolean;
  console?: boolean;
}

export interface AuditRecord {
  operation: 'select' | 'insert' | 'update' | 'delete';
  table: string;
  timestamp: number;
}

export class Auditor {
  private records: AuditRecord[] = [];
  private enabled: boolean;
  private logToConsole: boolean;

  constructor(config: AuditorConfig = {}) {
    this.enabled = config.enabled ?? true;
    this.logToConsole = config.console ?? false;
  }

  record(operation: AuditRecord['operation'], table: string): void {
    if (!this.enabled) return;

    const record: AuditRecord = {
      operation,
      table,
      timestamp: Date.now(),
    };

    this.records.push(record);

    if (this.logToConsole) {
      console.log('[Audit]', {
        operation: record.operation,
        table: record.table,
        time: new Date(record.timestamp).toISOString(),
      });
    }
  }

  getRecords(): readonly AuditRecord[] {
    return this.records;
  }

  clear(): void {
    this.records = [];
  }

  summary(): Record<string, Record<string, number>> {
    const result: Record<string, Record<string, number>> = {};

    for (const record of this.records) {
      if (!result[record.table]) {
        result[record.table] = {
          select: 0,
          insert: 0,
          update: 0,
          delete: 0,
        };
      }
      result[record.table][record.operation]++;
    }

    return result;
  }
}
