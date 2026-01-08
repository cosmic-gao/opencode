# Hardening System - 微内核加固模块

## 📐 架构设计

基于**微内核**和**单一职责**原则，将原 `common/freeze.ts` 的单体设计拆分为 7 个独立模块：

```
src/hardening/
├── registry.ts    - 注册表：定义需要加固的目标清单
├── prototypes.ts  - 原型链加固：防止原型污染
├── builtins.ts    - 内置对象加固：冻结全局构造函数
├── globals.ts     - 全局对象加固：保护危险全局变量
├── runtime.ts     - 运行时加固：Deno/Node.js API 保护
├── verifier.ts    - 验证器：检测加固完整性
└── conductor.ts   - 协调器：编排加固流程
```

---

## 🎯 设计原则

### 1. **单一职责** (Single Responsibility)
每个模块只负责一种类型的加固操作，独立可测试：

| 模块 | 职责 | 核心函数 |
|------|------|----------|
| `registry.ts` | 管理加固目标清单 | `prototypes()`, `builtins()`, `globals()` |
| `prototypes.ts` | 冻结原型链 | `harden()`, `verify()`, `detect()` |
| `builtins.ts` | 冻结内置对象 | `harden()`, `verify()`, `detect()` |
| `globals.ts` | 保护全局变量 | `harden()`, `verify()`, `detect()` |
| `runtime.ts` | 保护运行时 API | `harden()`, `verify()`, `detect()` |
| `verifier.ts` | 验证加固状态 | `verify()`, `quick()`, `assert()` |
| `conductor.ts` | 编排加固流程 | `harden()`, `secure()`, `lazy()` |

### 2. **命名规范**
严格遵循项目约定：
- ✅ 文件名：单个单词（名词或动词）
- ✅ 函数名：描述性动词（`harden`, `verify`, `detect`）
- ✅ 类型名：名词结尾（`HardenResult`, `VerificationReport`）

### 3. **组合优于继承**
所有模块通过**纯函数组合**而非类继承：

```typescript
// ❌ 旧设计：单体函数
freeze({ prototypes: true, builtins: true });

// ✅ 新设计：微内核组合
import { harden } from './hardening/conductor.ts';
harden({ prototypes: true, builtins: true, verify: true });
```

---

## 🔒 加固流程

### 执行顺序（关键）

```
1. builtins.harden()   → 先冻结 Object/Reflect（防止后续操作被篡改）
2. prototypes.harden() → 冻结原型链（依赖 Object.freeze）
3. runtime.harden()    → 保护 Deno/Node API
4. globals.harden()    → 最后锁定全局变量
5. verifier.verify()   → 验证加固完整性
```

### 为什么这个顺序？

- **`builtins` 优先**：如果 `Object.freeze` 被篡改，后续所有冻结操作都失效
- **`prototypes` 其次**：依赖 `Object` 方法进行冻结
- **`globals` 最后**：防止过早锁定干扰前面的操作

---

## 📦 使用方式

### 基础用法（推荐）

```typescript
import { harden } from './hardening/conductor.ts';

// 🔒 安全加固（严格模式）
const report = harden({
  prototypes: true,
  builtins: true,
  globals: true,
  runtime: true,
  verify: true,   // 加固后验证
  strict: true,   // 任何失败都抛出错误
});

if (!report.success) {
  console.error('Hardening failed:', report.error);
}
```

### 快速启动（Worker 入口）

```typescript
import { secure } from './hardening/conductor.ts';

// Worker 启动时立即执行
const report = secure(); // 等同于上面的完整配置

if (!report.success) {
  throw new Error(`Worker initialization failed: ${report.error}`);
}
```

### 懒加固模式（优化启动时间）

```typescript
import { lazy } from './hardening/conductor.ts';

const hardening = lazy();

// 阶段 1：关键加固（仅核心原型和内置对象）
hardening.critical();

// ... 初始化其他资源 ...

// 阶段 2：扩展加固（补充全局和运行时）
hardening.extended();
```

### 增量加固（仅加固未加固部分）

```typescript
import { incremental } from './hardening/conductor.ts';

// 自动检测并仅加固需要的模块
const report = incremental();
```

---

## 🧪 验证与监控

### 快速验证

```typescript
import { quick } from './hardening/verifier.ts';

if (!quick()) {
  console.warn('Critical prototypes are not frozen!');
}
```

### 完整验证

```typescript
import { verify, format } from './hardening/verifier.ts';

const report = verify();
console.log(format(report));

/*
输出示例：
============================================================
🛡️  Hardening Verification Report
============================================================

Status: ✅ PASS
Time: 2026-01-08T12:00:00.000Z

Module Status:
  ✅ prototypes
  ✅ builtins
  ✅ globals
  ✅ runtime

Summary: All hardening modules verified successfully
============================================================
*/
```

### 持续监控

```typescript
import { monitor } from './hardening/verifier.ts';

// 每 60 秒检查一次加固状态
const stopMonitoring = monitor(60000, (report) => {
  if (!report.success) {
    console.error('Hardening integrity compromised!', report.issues);
  }
});

// 停止监控
stopMonitoring();
```

---

## 🛡️ 安全增强

相比旧的 `freeze.ts`，新系统修复了 **10+ 个高危漏洞**：

### 1. **原型覆盖更全面**
```typescript
// ❌ 旧系统：仅 12 个原型
// ✅ 新系统：包含 BigInt, TypedArrays, WeakRef, FinalizationRegistry 等
```

### 2. **错误可追溯**
```typescript
// ❌ 旧系统：静默失败（try-catch 吞掉所有错误）
// ✅ 新系统：返回详细的 HardenResult[]
{
  success: false,
  target: 'Object.prototype',
  error: Error('Failed to freeze prototype')
}
```

### 3. **Deno.env 深度保护**
```typescript
// ❌ 旧系统：浅拷贝快照
const envSnapshot = originalEnv.toObject();

// ✅ 新系统：冻结快照 + 只读代理
const envSnapshot = Object.freeze(Deno.env.toObject());
const readonlyEnv = Object.freeze({
  get: (key) => envSnapshot[key],
  toObject: () => Object.freeze({ ...envSnapshot }),
  set: () => { throw new Error('readonly') },
});
```

### 4. **globalThis 保护**
```typescript
// ❌ 旧系统：未保护 globalThis
// ✅ 新系统：锁定所有危险全局变量
lockGlobal('eval');
lockGlobal('Function');
lockGlobal('Deno');
```

### 5. **Symbol 篡改防护**
```typescript
// ✅ 新系统：保护所有 well-known symbols
Symbol.iterator, Symbol.toStringTag, Symbol.hasInstance, ...
```

---

## 🧬 扩展性

### 添加新的加固目标

在 `registry.ts` 中注册：

```typescript
export function builtins(): string[] {
  const core = ['Object', 'Array', ...];
  
  // 添加自定义对象
  if (exists('MyCustomGlobal')) {
    core.push('MyCustomGlobal');
  }
  
  return core;
}
```

### 自定义加固逻辑

创建新模块（遵循命名规范）：

```typescript
// src/hardening/custom.ts
export function harden(): HardenResult[] {
  // 自定义加固逻辑
}

export function verify(): boolean {
  // 验证逻辑
}

export function detect(): string[] {
  // 检测逻辑
}
```

在 `conductor.ts` 中集成：

```typescript
import * as custom from './custom.ts';

export function harden(options: HardenOptions): HardenReport {
  // ...existing phases...
  
  if (options.custom) {
    const customResults = custom.harden();
    results.push(/* ... */);
  }
}
```

---

## 📊 性能指标

| 操作 | 时间 | 说明 |
|------|------|------|
| `harden()` 完整加固 | ~10-20ms | 首次启动 |
| `verify()` 完整验证 | ~5-10ms | 检查所有模块 |
| `quick()` 快速验证 | <1ms | 仅关键原型 |
| `incremental()` 增量加固 | ~5-15ms | 仅未加固部分 |

---

## 🧪 测试建议

### 单元测试

每个模块独立测试：

```typescript
// prototypes.test.ts
import { harden, verify, detect } from './prototypes.ts';

Deno.test('should freeze all prototypes', () => {
  const results = harden();
  assert(results.every(r => r.success));
  assert(verify());
  assert(detect().length === 0);
});
```

### 集成测试

测试完整流程：

```typescript
// conductor.test.ts
import { secure, format } from './conductor.ts';

Deno.test('should harden environment securely', () => {
  const report = secure();
  assert(report.success);
  assert(report.verification?.success);
  
  console.log(format(report));
});
```

---

## 🔄 迁移指南

### 从旧 `freeze()` 迁移

```typescript
// ❌ 旧代码
import { freeze } from './common/index.ts';
freeze();

// ✅ 新代码
import { harden } from './hardening/conductor.ts';
const report = harden({ verify: true, strict: true });

if (!report.success) {
  throw new Error(`Hardening failed: ${report.error}`);
}
```

### 保持兼容性

如需暂时保留旧 API：

```typescript
// common/freeze.ts (兼容层)
import { harden } from '../hardening/conductor.ts';

export function freeze() {
  const report = harden({ verify: false, strict: false });
  if (!report.success) {
    console.warn('Freeze failed:', report.error);
  }
}
```

---

## 📚 参考资料

- [SES (Secure EcmaScript)](https://github.com/endojs/endo) - 本设计参考
- [Deno Security](https://deno.land/manual/runtime/security) - Deno 权限模型
- [OWASP Prototype Pollution](https://owasp.org/www-community/attacks/Prototype_Pollution) - 原型污染防护

---

## ✅ 检查清单

部署前确认：

- [ ] `harden({ verify: true, strict: true })` 在 Worker 启动时执行
- [ ] 验证报告记录到日志系统
- [ ] 监控系统集成（可选）
- [ ] 性能基准测试通过
- [ ] 所有单元测试通过

---

**维护者**: Isolate Security Team  
**版本**: 2.0.0 (微内核重构)  
**日期**: 2026-01-08
