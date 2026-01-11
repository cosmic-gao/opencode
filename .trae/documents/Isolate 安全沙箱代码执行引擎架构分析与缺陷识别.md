# 工具完整性保护强化计划

## 1. 现状分析

### 1.1 当前工具保护机制

#### 1.1.1 注入防护 ([inject.ts](file:///e:/opencode/apps/isolate/src/common/inject.ts))
```typescript
Object.defineProperty(scope, name, {
  value,
  writable: false,      // 防止属性值被修改
  enumerable: true,
  configurable: false,   // 防止属性被删除或重新定义
});
```
**优点**：防止直接属性覆盖
**缺点**：不保护对象内部属性，不保护原型链

#### 1.1.2 代理防护 ([proxy.ts](file:///e:/opencode/apps/isolate/src/common/proxy.ts))
```typescript
// crypto 工具使用代理
const safe = proxy(self.crypto, {
  whitelist: config?.methods ?? defaults,
  validator: validator(config)
});
```
**优点**：限制可访问的方法，验证参数
**缺点**：代理不深入，内部对象属性可能被篡改

#### 1.1.3 工具结构示例
- **crypto 工具**：代理 `self.crypto` 的特定方法
- **channel 工具**：创建自定义 API 对象（`{emit, on, off}`）
- **database 工具**：返回复杂的 Store 对象

### 1.2 潜在攻击向量

#### 1.2.1 直接篡改（已防护）
```javascript
globalThis.crypto = maliciousObject;  // 被 Object.defineProperty 阻止
```

#### 2.2.2 原型链污染（未完全防护）
```javascript
// 攻击：污染工具对象的原型
Object.getPrototypeOf(globalThis.crypto).malicious = function() {};

// 攻击：污染内置原型
Array.prototype.push = function() {
  // 干扰工具的内部数组操作
};
```

#### 2.2.3 内部属性篡改（部分防护）
```javascript
// 假设工具有内部状态
globalThis.crypto._internalState = 'compromised';  // 如果代理不深入
```

## 2. 保护策略：三层防御

### 2.1 层一：工具对象深度保护（高优先级）

#### 2.1.1 增强 inject 函数
**修改文件**：[inject.ts](file:///e:/opencode/apps/isolate/src/common/inject.ts)
**功能**：添加深度保护选项
```typescript
export function inject(
  scope: Record<string, unknown>,
  name: string,
  value: unknown,
  options?: { deep?: boolean; seal?: boolean; }
): void {
  // 深度保护对象
  if (options?.deep && value && typeof value === 'object') {
    value = deepProtect(value, options.seal ?? true);
  }
  
  Object.defineProperty(scope, name, {
    value,
    writable: false,
    enumerable: true,
    configurable: false,
  });
}
```

#### 2.1.2 深度保护实现
**新增文件**：`src/security/deep-protect.ts`
**功能**：递归保护对象
```typescript
export function deepProtect<T>(obj: T, seal: boolean = true): T {
  if (!obj || typeof obj !== 'object') return obj;
  
  // 防止原型污染：使用 null 原型或冻结原型
  if (Object.getPrototypeOf(obj) !== null) {
    Object.setPrototypeOf(obj, null);
  }
  
  // 深度保护所有属性
  for (const key of Reflect.ownKeys(obj)) {
    const desc = Object.getOwnPropertyDescriptor(obj, key);
    if (desc) {
      const newDesc = { ...desc };
      newDesc.configurable = false;
      newDesc.writable = false;
      
      // 递归保护属性值
      if (desc.value && typeof desc.value === 'object') {
        newDesc.value = deepProtect(desc.value, seal);
      }
      
      Object.defineProperty(obj, key, newDesc);
    }
  }
  
  return seal ? Object.seal(obj) : obj;
}
```

### 2.2 层二：关键依赖保护（中优先级）

#### 2.2.1 识别工具依赖
分析各工具依赖的内置函数：
- **crypto**：依赖 `ArrayBuffer`、`Uint8Array`、`TextEncoder`
- **channel**：依赖 `Map`、`Set`、`queueMicrotask`
- **database**：依赖 `Promise`、`Array`、`Object`

#### 2.2.2 创建安全副本
**新增文件**：`src/security/safe-globals.ts`
```typescript
export const SAFE_GLOBALS = {
  // 工具依赖的内置对象的安全副本
  Array: deepProtect(Array),
  Object: deepProtect(Object),
  Map: deepProtect(Map),
  Set: deepProtect(Set),
  Promise: deepProtect(Promise),
  // ... 其他依赖
};

// 在工具初始化时使用
function setupTool(scope: Record<string, unknown>) {
  // 使用安全的内置对象副本
  const safeArray = SAFE_GLOBALS.Array;
  // ...
}
```

### 2.3 层三：运行时完整性验证（低优先级）

#### 2.3.1 工具完整性检查
**新增文件**：`src/security/integrity-check.ts`
```typescript
export function verifyToolIntegrity(toolName: string, toolObject: unknown): boolean {
  const expectedProps = getExpectedProperties(toolName);
  
  for (const prop of expectedProps) {
    const desc = Object.getOwnPropertyDescriptor(toolObject, prop);
    if (!desc || desc.configurable || desc.writable) {
      securityLog('tool-integrity-violation', { toolName, prop });
      return false;
    }
  }
  
  return true;
}
```

#### 2.3.2 定期检查机制
在关键点（工具使用前后）执行完整性检查。

## 3. 具体工具保护方案

### 3.1 crypto 工具增强
**修改文件**：[crypto.ts](file:///e:/opencode/apps/isolate/src/tools/crypto.ts)
```typescript
export function crypto(config?: CryptoConfig): Tool {
  return {
    name: 'crypto',
    setup: (globals) => {
      // 创建深度保护的代理对象
      const safeCrypto = deepProtect(
        proxy(self.crypto, {
          whitelist: config?.methods ?? defaults,
          validator: validator(config)
        }),
        true  // 完全密封
      );
      
      inject(globals, 'crypto', safeCrypto, { deep: true });
    },
  };
}
```

### 3.2 channel 工具增强
**修改文件**：[channel.ts](file:///e:/opencode/apps/isolate/src/tools/channel.ts)
```typescript
export const channel: Tool = {
  name: 'channel',
  setup: (scope) => {
    // 创建无原型的 API 对象
    const api = Object.create(null);
    
    api.emit = (topic: string, data: unknown) => {
      self.postMessage({ type: 'channel', topic, data });
    };
    
    // 深度保护 API 对象
    const protectedApi = deepProtect(api);
    
    inject(scope, 'channel', protectedApi, { deep: true });
  },
};
```

### 3.3 database 工具增强
**修改文件**：[database/index.ts](file:///e:/opencode/apps/isolate/src/tools/database/index.ts)
```typescript
export function database(config?: Config): Tool {
  return {
    name: 'database',
    setup: async (scope: Record<string, unknown>): Promise<void> => {
      // ... 初始化 store
      
      // 深度保护 store 对象
      const protectedStore = deepProtect(store as Record<string, unknown>, true);
      
      inject(scope, 'database', protectedStore, { deep: true });
    },
  };
}
```

## 4. 实施步骤

### 4.1 第一阶段：基础深度保护（1-2天）
1. 实现 `deepProtect` 函数
2. 增强 `inject` 函数支持深度保护
3. 更新 crypto 工具使用深度保护
4. 添加基础测试

### 4.2 第二阶段：所有工具保护（2-3天）
1. 更新 channel 和 database 工具
2. 验证工具完整性检查
3. 性能测试和优化

### 4.3 第三阶段：增强依赖保护（1-2天）
1. 识别关键依赖
2. 实现安全全局对象副本
3. 集成到工具初始化中

## 5. 测试方案

### 5.1 篡改防御测试
**新增文件**：`test/security/tool-protection.test.ts`
```typescript
// 测试用例
test('crypto tool cannot be modified', () => {
  // 尝试修改属性
  expect(() => { globalThis.crypto.newProp = 'malicious'; }).toThrow();
  
  // 尝试删除属性
  expect(() => { delete globalThis.crypto.getRandomValues; }).toThrow();
  
  // 尝试修改原型
  expect(() => { Object.setPrototypeOf(globalThis.crypto, {}); }).toThrow();
});
```

### 5.2 原型污染防护测试
```typescript
test('tools immune to prototype pollution', () => {
  // 污染内置原型
  Object.prototype.polluted = 'malicious';
  
  // 验证工具不受影响
  expect(globalThis.crypto.polluted).toBeUndefined();
  
  // 清理
  delete Object.prototype.polluted;
});
```

### 5.3 完整性检查测试
```typescript
test('tool integrity verification', () => {
  const isIntact = verifyToolIntegrity('crypto', globalThis.crypto);
  expect(isIntact).toBe(true);
});
```

## 6. 性能影响评估

### 6.1 预期开销
- **内存开销**：额外对象副本，轻微增加
- **CPU开销**：深度保护递归遍历，一次性初始化开销
- **运行时开销**：代理 trap 执行，与现有代理机制相似

### 6.2 优化策略
- **惰性保护**：只在需要时深度保护
- **缓存机制**：复用保护对象
- **选择性保护**：仅保护关键工具和属性

## 7. 向后兼容性

### 7.1 行为变化
- **无功能变化**：工具 API 保持不变
- **增加安全性**：防止篡改，提高可靠性
- **错误处理**：篡改尝试抛出明确错误

### 7.2 迁移路径
- **零迁移成本**：现有代码继续工作
- **增强测试**：现有测试应全部通过
- **渐进部署**：可逐个工具启用保护

## 8. 成功指标

1. **安全指标**：
   - 所有篡改尝试被阻止（测试覆盖率 100%）
   - 工具完整性检查通过率 100%
   - 零原型污染影响

2. **性能指标**：
   - 工具初始化时间增加 < 20%
   - 内存使用增加 < 10%
   - 运行时性能影响 < 5%

3. **质量指标**：
   - 现有测试全部通过
   - 新增测试覆盖率 > 90%
   - 代码复杂度保持可控

---

此计划专注于保护工具完整性，避免全面的沙箱隔离开销，实现安全性与性能的最佳平衡。