import * as prototypes from './prototypes.ts';
import * as builtins from './builtins.ts';
import * as globals from './globals.ts';
import * as runtime from './runtime.ts';
export interface VerificationReport {
  success: boolean;
  timestamp: number;
  modules: ModuleStatus[];
  issues: string[];
  summary: string;
}
export interface ModuleStatus {
  name: string;
  verified: boolean;
  detected: string[];
}
export function verify(): VerificationReport {
  const timestamp = Date.now();
  const modules: ModuleStatus[] = [];
  const issues: string[] = [];
  const prototypeVerified = prototypes.verify();
  const prototypeIssues = prototypes.detect();
  modules.push({
    name: 'prototypes',
    verified: prototypeVerified,
    detected: prototypeIssues,
  });
  if (!prototypeVerified) {
    issues.push('Prototype chain is not fully hardened');
  }
  issues.push(...prototypeIssues);
  const builtinVerified = builtins.verify();
  const builtinIssues = builtins.detect();
  modules.push({
    name: 'builtins',
    verified: builtinVerified,
    detected: builtinIssues,
  });
  if (!builtinVerified) {
    issues.push('Built-in objects are not fully hardened');
  }
  issues.push(...builtinIssues);
  const globalVerified = globals.verify();
  const globalIssues = globals.detect();
  modules.push({
    name: 'globals',
    verified: globalVerified,
    detected: globalIssues,
  });
  if (!globalVerified) {
    issues.push('Global objects are not fully hardened');
  }
  issues.push(...globalIssues);
  const runtimeVerified = runtime.verify();
  const runtimeIssues = runtime.detect();
  modules.push({
    name: 'runtime',
    verified: runtimeVerified,
    detected: runtimeIssues,
  });
  if (!runtimeVerified) {
    issues.push('Runtime environment is not fully hardened');
  }
  issues.push(...runtimeIssues);
  const allVerified = modules.every(m => m.verified);
  const success = allVerified && issues.length === 0;
  const summary = success
    ? 'All hardening modules verified successfully'
    : `Verification failed: ${issues.length} issue(s) detected`;
  return {
    success,
    timestamp,
    modules,
    issues,
    summary,
  };
}
export function quick(): boolean {
  const criticalPrototypes = [
    Object.prototype,
    Array.prototype,
    Function.prototype,
  ];
  for (const proto of criticalPrototypes) {
    if (!Object.isFrozen(proto)) {
      return false;
    }
  }
  const criticalBuiltins = ['Object', 'Reflect'];
  for (const name of criticalBuiltins) {
    const obj = (globalThis as Record<string, unknown>)[name];
    if (!obj || !Object.isFrozen(obj)) {
      return false;
    }
  }
  if (typeof Deno !== 'undefined') {
    if (!Object.isFrozen(Deno.permissions)) {
      return false;
    }
  }
  return true;
}
export function monitor(interval: number, callback: (report: VerificationReport) => void): () => void {
  const timer = setInterval(() => {
    const report = verify();
    callback(report);
  }, interval);
  return () => clearInterval(timer);
}
export function format(report: VerificationReport): string {
  const lines: string[] = [];
  lines.push('='.repeat(60));
  lines.push('🛡️  Hardening Verification Report');
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(`Status: ${report.success ? '✅ PASS' : '❌ FAIL'}`);
  lines.push(`Time: ${new Date(report.timestamp).toISOString()}`);
  lines.push('');
  lines.push('Module Status:');
  for (const module of report.modules) {
    const status = module.verified ? '✅' : '❌';
    lines.push(`  ${status} ${module.name}`);
    if (module.detected.length > 0) {
      for (const issue of module.detected) {
        lines.push(`      ⚠️  ${issue}`);
      }
    }
  }
  lines.push('');
  if (report.issues.length > 0) {
    lines.push('Issues Detected:');
    for (const issue of report.issues) {
      lines.push(`  - ${issue}`);
    }
    lines.push('');
  }
  lines.push(`Summary: ${report.summary}`);
  lines.push('='.repeat(60));
  return lines.join('\n');
}
export function assert(): void {
  const report = verify();
  if (!report.success) {
    const message = [
      'Hardening verification failed!',
      '',
      format(report),
    ].join('\n');
    throw new Error(message);
  }
}
export function coverage(): {
  prototypes: { total: number; frozen: number; percentage: number };
  builtins: { total: number; frozen: number; percentage: number };
  overall: number;
} {
  const protoList = [
    Object, Array, Function, String, Number, Boolean,
    Date, RegExp, Error, Map, Set, Promise,
  ];
  const frozenProtos = protoList.filter(c => Object.isFrozen(c.prototype)).length;
  const builtinList = [
    'Object', 'Array', 'Function', 'Math', 'JSON',
    'Map', 'Set', 'Promise', 'Symbol', 'Proxy', 'Reflect',
  ];
  const frozenBuiltins = builtinList.filter(name => {
    const obj = (globalThis as Record<string, unknown>)[name];
    return obj && Object.isFrozen(obj);
  }).length;
  const protoPercentage = (frozenProtos / protoList.length) * 100;
  const builtinPercentage = (frozenBuiltins / builtinList.length) * 100;
  const overall = (protoPercentage + builtinPercentage) / 2;
  return {
    prototypes: {
      total: protoList.length,
      frozen: frozenProtos,
      percentage: protoPercentage,
    },
    builtins: {
      total: builtinList.length,
      frozen: frozenBuiltins,
      percentage: builtinPercentage,
    },
    overall,
  };
}
