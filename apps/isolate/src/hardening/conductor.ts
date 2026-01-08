import * as prototypes from './prototypes.ts';
import * as builtins from './builtins.ts';
import * as globals from './globals.ts';
import * as runtime from './runtime.ts';
import * as verifier from './verifier.ts';
export interface HardenOptions {
  prototypes?: boolean;
  builtins?: boolean;
  globals?: boolean;
  runtime?: boolean;
  verify?: boolean;
  strict?: boolean;
  lazy?: boolean;
}
export interface HardenReport {
  success: boolean;
  timestamp: number;
  duration: number;
  results: HardenResult[];
  verification?: verifier.VerificationReport;
  error?: Error;
}
export interface HardenResult {
  module: string;
  success: boolean;
  operations: number;
  failures: number;
  details: Array<{ target: string; success: boolean; error?: Error }>;
}
export function harden(options: HardenOptions = {}): HardenReport {
  const startTime = Date.now();
  const results: HardenResult[] = [];
  let hardenError: Error | undefined;
  const {
    prototypes: enablePrototypes = true,
    builtins: enableBuiltins = true,
    globals: enableGlobals = true,
    runtime: enableRuntime = true,
    verify: enableVerify = true,
    strict = false,
    lazy: _lazy = false,
  } = options;
  try {
    if (enableBuiltins) {
      const builtinResults = builtins.harden();
      const failures = builtinResults.filter(r => !r.success).length;
      results.push({
        module: 'builtins',
        success: failures === 0,
        operations: builtinResults.length,
        failures,
        details: builtinResults,
      });
      if (strict && failures > 0) {
        throw new Error(`Builtins hardening failed: ${failures} operations`);
      }
    }
    if (enablePrototypes) {
      const prototypeResults = prototypes.harden();
      const failures = prototypeResults.filter(r => !r.success).length;
      results.push({
        module: 'prototypes',
        success: failures === 0,
        operations: prototypeResults.length,
        failures,
        details: prototypeResults,
      });
      if (strict && failures > 0) {
        throw new Error(`Prototypes hardening failed: ${failures} operations`);
      }
    }
    if (enableRuntime) {
      const runtimeResults = runtime.harden();
      const failures = runtimeResults.filter(r => !r.success).length;
      results.push({
        module: 'runtime',
        success: failures === 0,
        operations: runtimeResults.length,
        failures,
        details: runtimeResults,
      });
      if (strict && failures > 0) {
        throw new Error(`Runtime hardening failed: ${failures} operations`);
      }
    }
    if (enableGlobals) {
      const globalResults = globals.harden();
      const failures = globalResults.filter(r => !r.success).length;
      results.push({
        module: 'globals',
        success: failures === 0,
        operations: globalResults.length,
        failures,
        details: globalResults,
      });
      if (strict && failures > 0) {
        throw new Error(`Globals hardening failed: ${failures} operations`);
      }
    }
  } catch (error) {
    hardenError = error instanceof Error ? error : new Error(String(error));
  }
  const duration = Date.now() - startTime;
  let verification: verifier.VerificationReport | undefined;
  if (enableVerify && !hardenError) {
    verification = verifier.verify();
    if (strict && !verification.success) {
      hardenError = new Error(`Verification failed: ${verification.summary}`);
    }
  }
  const allSuccess = results.every(r => r.success) && !hardenError;
  return {
    success: allSuccess,
    timestamp: startTime,
    duration,
    results,
    verification,
    error: hardenError,
  };
}
export function lazy(): {
  critical: () => HardenReport;
  extended: () => HardenReport;
} {
  return {
    critical: () => harden({
      prototypes: true,
      builtins: true,
      globals: false,
      runtime: false,
      verify: false,
      strict: true,
    }),
    extended: () => harden({
      prototypes: false,
      builtins: false,
      globals: true,
      runtime: true,
      verify: true,
      strict: false,
    }),
  };
}
export function incremental(): HardenReport {
  const needsPrototypes = !prototypes.verify();
  const needsBuiltins = !builtins.verify();
  const needsGlobals = !globals.verify();
  const needsRuntime = !runtime.verify();
  return harden({
    prototypes: needsPrototypes,
    builtins: needsBuiltins,
    globals: needsGlobals,
    runtime: needsRuntime,
    verify: true,
    strict: false,
  });
}
export function format(report: HardenReport): string {
  const lines: string[] = [];
  lines.push('='.repeat(60));
  lines.push('🔒 Hardening Report');
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(`Status: ${report.success ? '✅ SUCCESS' : '❌ FAILED'}`);
  lines.push(`Duration: ${report.duration}ms`);
  lines.push(`Time: ${new Date(report.timestamp).toISOString()}`);
  lines.push('');
  if (report.error) {
    lines.push(`Error: ${report.error.message}`);
    lines.push('');
  }
  lines.push('Module Results:');
  for (const result of report.results) {
    const status = result.success ? '✅' : '❌';
    const rate = `${result.operations - result.failures}/${result.operations}`;
    lines.push(`  ${status} ${result.module}: ${rate} operations succeeded`);
    if (result.failures > 0) {
      const failed = result.details.filter(d => !d.success);
      for (const detail of failed.slice(0, 3)) { // 最多显示3个失败
        lines.push(`      ❌ ${detail.target}: ${detail.error?.message || 'unknown error'}`);
      }
      if (result.failures > 3) {
        lines.push(`      ... and ${result.failures - 3} more failures`);
      }
    }
  }
  lines.push('');
  if (report.verification) {
    lines.push('Verification:');
    lines.push(`  Status: ${report.verification.success ? '✅ PASS' : '❌ FAIL'}`);
    lines.push(`  Summary: ${report.verification.summary}`);
    if (report.verification.issues.length > 0) {
      lines.push('  Issues:');
      for (const issue of report.verification.issues.slice(0, 5)) {
        lines.push(`    - ${issue}`);
      }
      if (report.verification.issues.length > 5) {
        lines.push(`    ... and ${report.verification.issues.length - 5} more issues`);
      }
    }
    lines.push('');
  }
  lines.push('='.repeat(60));
  return lines.join('\n');
}
export function assert(options?: HardenOptions): void {
  const report = harden({ ...options, verify: true, strict: true });
  if (!report.success) {
    const message = [
      'Hardening failed!',
      '',
      format(report),
    ].join('\n');
    throw new Error(message);
  }
}
export function secure(): HardenReport {
  return harden({
    prototypes: true,
    builtins: true,
    globals: true,
    runtime: true,
    verify: true,
    strict: true,
  });
}
