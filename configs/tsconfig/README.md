# @opencode/tsconfig

> OpenCode 项目的 TypeScript 配置预设集合

## 📋 概述

这是一个共享的 TypeScript 配置包，为 OpenCode monorepo 中的不同项目类型提供统一的 TypeScript 编译配置。通过继承这些预设配置，可以确保整个代码库的类型检查规则一致性。

## 📦 包含配置

| 配置文件 | 说明 | 继承关系 | 适用场景 |
|---------|------|---------|---------|
| `base.json` | 基础配置 | - | 所有配置的基础 |
| `lib.json` | 库项目配置 | `base.json` | npm 包、通用库 |
| `esm.json` | ESM 模块配置 | `base.json` | ESM 库、Deno 项目 |
| `node.json` | Node.js 配置 | `base.json` | Node.js 服务端项目 |
| `web.json` | Web 基础配置 | `base.json` | 浏览器端项目 |
| `vite.json` | Vite 项目配置 | `web.json` | Vite 构建项目 |
| `react.json` | React 配置 | `vite.json` | React + Vite 项目 |
| `vue3.json` | Vue 3 配置 | `vite.json` | Vue 3 + Vite 项目 |

---

## 配置详解

### base.json - 基础配置

**核心特性**：

- **严格模式**：启用所有严格类型检查
- **模块化**：现代 ESNext 模块系统
- **声明生成**：自动生成 `.d.ts` 类型声明文件
- **源码映射**：生成 SourceMap 便于调试

**主要配置项**：

```json
{
  "target": "esnext",                    // 目标 ECMAScript 版本
  "module": "esnext",                    // 模块系统
  "moduleResolution": "bundler",         // 模块解析策略（适用于打包工具）
  "strict": true,                        // 启用所有严格检查
  "esModuleInterop": true,               // CJS/ESM 互操作性
  "skipLibCheck": true,                  // 跳过库文件类型检查（加速编译）
  "forceConsistentCasingInFileNames": true, // 强制文件名大小写一致
  "resolveJsonModule": true,             // 允许导入 JSON 文件
  "isolatedModules": true,               // 确保每个文件可独立转译
  "declaration": true,                   // 生成类型声明文件
  "declarationMap": true,                // 生成声明文件的 SourceMap
  "sourceMap": true,                     // 生成 JS SourceMap
  "noUnusedLocals": true,                // 禁止未使用的局部变量
  "noUnusedParameters": true,            // 禁止未使用的函数参数
  "noFallthroughCasesInSwitch": true,    // 禁止 switch 穿透
  "noUncheckedIndexedAccess": true,      // 索引访问返回 T | undefined
  "allowSyntheticDefaultImports": true   // 允许合成默认导入
}
```

---

### lib.json - 库项目配置

**用途**：用于构建可发布的 npm 包或内部共享库。

**扩展配置**：

```json
{
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["esnext"],                   // 使用最新 JS 特性
    "outDir": "dist",                    // 输出目录
    "removeComments": false,             // 保留注释（重要文档）
    "composite": true,                   // 启用项目引用
    "incremental": true                  // 增量编译
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.spec.ts", "**/*.test.ts"]
}
```

**适用项目**：
- `packages/plugable` - 插件系统库
- 其他可复用的通用库

---

### esm.json - ESM 模块配置

**用途**：专为纯 ESM 模块和 Deno 项目设计。

**关键特性**：

```json
{
  "extends": "./base.json",
  "compilerOptions": {
    "module": "esnext",
    "moduleResolution": "bundler",
    "verbatimModuleSyntax": true,        // 严格 ESM 语法（保留 import type）
    "allowImportingTsExtensions": true,  // 允许导入 .ts 扩展名
    "noEmit": false,                     // 允许输出文件
    "emitDeclarationOnly": false         // 不仅输出声明文件
  }
}
```

**适用项目**：
- `apps/isolate` - Deno 沙箱服务（需要显式 `.ts` 扩展名）
- 纯 ESM 库项目

**Deno 兼容性**：
- 设置 `allowImportingTsExtensions: true` 允许 `import './module.ts'`
- 设置 `verbatimModuleSyntax: true` 确保 `import type` 语法保留

---

### node.json - Node.js 配置

**用途**：Node.js 服务端应用。

```json
{
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["esnext"],
    "types": ["node"],                   // 包含 Node.js 类型定义
    "moduleResolution": "node"           // Node.js 模块解析算法
  }
}
```

**适用项目**：
- Node.js 后端服务
- CLI 工具
- 构建脚本

---

### web.json - Web 基础配置

**用途**：浏览器端项目的基础配置。

```json
{
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["esnext", "dom", "dom.iterable"], // 包含 DOM API
    "useDefineForClassFields": true           // 使用标准类字段行为
  }
}
```

**适用项目**：
- 浏览器端应用
- Web Components
- 前端库

---

### vite.json - Vite 项目配置

**用途**：使用 Vite 构建的项目。

```json
{
  "extends": "./web.json",
  "compilerOptions": {
    "types": ["vite/client"],            // Vite 环境类型
    "noEmit": true                       // Vite 处理编译，TS 只做检查
  }
}
```

**特点**：
- 由 Vite 负责实际的代码转译和打包
- TypeScript 仅用于类型检查
- 包含 `import.meta.env` 等 Vite 特性的类型定义

---

### react.json - React 配置

**用途**：React + Vite 项目。

```json
{
  "extends": "./vite.json",
  "compilerOptions": {
    "jsx": "react-jsx",                  // 使用新版 JSX 转换（无需导入 React）
    "jsxImportSource": "react",          // JSX 运行时来源
    "types": ["vite/client", "@types/react", "@types/react-dom"]
  }
}
```

**支持特性**：
- 自动 JSX 运行时（React 17+）
- `.tsx` 文件支持
- React Hooks 类型推断

---

### vue3.json - Vue 3 配置

**用途**：Vue 3 + Vite 项目。

```json
{
  "extends": "./vite.json",
  "compilerOptions": {
    "jsx": "preserve",                   // 保留 JSX（由 Vite 插件处理）
    "jsxImportSource": "vue",            // Vue 3 JSX 运行时
    "types": ["vite/client"]
  }
}
```

**支持特性**：
- `.vue` 单文件组件（需配合 `vue-tsc`）
- Vue 3 组合式 API
- Vue TSX/JSX 支持

**适用项目**：
- `apps/codex` - Vue 3 应用

---

## 使用方式

### 1. 在项目中引用

在项目的 `tsconfig.json` 中继承相应配置：

```json
{
  "extends": "@opencode/tsconfig/lib.json",
  "compilerOptions": {
    // 项目特定的覆盖配置
  }
}
```

### 2. 配置选择指南

| 项目类型 | 推荐配置 | 示例 |
|---------|---------|------|
| npm 包 | `lib.json` | `packages/plugable` |
| Deno 项目 | `esm.json` | `apps/isolate` |
| Node.js 服务 | `node.json` | 后端 API 服务 |
| React 应用 | `react.json` | React SPA |
| Vue 3 应用 | `vue3.json` | `apps/codex` |
| 通用前端 | `vite.json` | 非框架特定的 Vite 项目 |

### 3. 示例：库项目配置

```json
// packages/my-lib/tsconfig.json
{
  "extends": "@opencode/tsconfig/lib.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"],
  "exclude": ["**/*.test.ts"]
}
```

### 4. 示例：Deno 项目配置

```json
// apps/deno-app/tsconfig.json
{
  "extends": "@opencode/tsconfig/esm.json",
  "compilerOptions": {
    "lib": ["deno.ns", "deno.worker", "esnext"],
    "noEmit": true  // Deno 运行时直接执行 TS
  }
}
```

---

## 配置继承链

```
base.json (基础)
    ├── lib.json (库项目)
    ├── esm.json (ESM 模块)
    ├── node.json (Node.js)
    └── web.json (Web 项目)
            └── vite.json (Vite 构建)
                    ├── react.json (React 框架)
                    └── vue3.json (Vue 3 框架)
```

---

## 关键配置说明

### moduleResolution

| 值 | 说明 | 适用场景 |
|----|------|---------|
| `bundler` | 打包工具解析（Vite/Webpack） | 现代前端项目 |
| `node` | Node.js 解析算法 | Node.js 项目 |
| `nodenext` | Node.js 16+ ESM 解析 | 使用 `"type": "module"` 的 Node 项目 |

### lib

| 值 | 包含的 API | 使用场景 |
|----|----------|---------|
| `esnext` | 最新 ECMAScript 特性 | 所有现代项目 |
| `dom` | DOM API（document、window 等） | 浏览器端项目 |
| `dom.iterable` | DOM 集合的迭代器 | 浏览器端项目 |
| `deno.ns` | Deno 全局 API | Deno 项目 |
| `deno.worker` | Deno Worker API | Deno Worker 项目 |

### jsx

| 值 | 输出结果 | 使用场景 |
|----|---------|---------|
| `react-jsx` | React 17+ 新转换 | React 项目（推荐） |
| `preserve` | 保留 JSX 不转换 | Vue/自定义 JSX 转换 |

---

## 常见问题

### 1. 为什么 Deno 项目需要 `allowImportingTsExtensions`？

Deno 要求显式指定文件扩展名：

```typescript
// ❌ TypeScript 默认不允许
import { foo } from './module.ts'

// ✅ 启用 allowImportingTsExtensions 后允许
import { foo } from './module.ts'
```

### 2. `verbatimModuleSyntax` 有什么作用？

确保 `import type` 语法保留，防止类型导入被编译为运行时导入：

```typescript
// 使用 verbatimModuleSyntax: true
import type { Foo } from './types.ts'  // 编译后完全移除

// 不使用时可能被转换为
import { Foo } from './types.ts'  // 运行时导入（可能报错）
```

### 3. 为什么 Vite 项目设置 `noEmit: true`？

Vite 使用 esbuild 进行快速转译，TypeScript 编译器仅用于类型检查：

- **开发模式**：Vite 实时转译，无需 tsc 输出
- **生产构建**：Vite 完成打包，无需 tsc 输出
- **类型检查**：`tsc --noEmit` 或 `vue-tsc --noEmit`

### 4. `composite` 和 `incremental` 的区别？

- **`incremental: true`**：启用增量编译，加速重复构建
- **`composite: true`**：启用项目引用（Project References），支持 monorepo 中的包依赖

---

## 最佳实践

### 1. 继承而非复制

✅ **推荐**：
```json
{ "extends": "@opencode/tsconfig/lib.json" }
```

❌ **避免**：
```json
{ 
  "compilerOptions": { /* 复制所有配置 */ }
}
```

### 2. 最小化覆盖

仅覆盖项目特定的配置：

```json
{
  "extends": "@opencode/tsconfig/react.json",
  "compilerOptions": {
    "baseUrl": ".",          // 项目特定：路径别名基础
    "paths": {               // 项目特定：路径映射
      "@/*": ["src/*"]
    }
  }
}
```

### 3. 区分环境配置

复杂项目可使用多个 `tsconfig.json`：

```
project/
├── tsconfig.json           # 继承 @opencode/tsconfig/react.json
├── tsconfig.node.json      # 继承 @opencode/tsconfig/node.json (Vite 配置)
└── tsconfig.test.json      # 测试环境配置
```

---

## 更新日志

### v0.0.0 (初始版本)

- 创建 8 个预设配置
- 支持 lib、ESM、Node.js、Web、Vite、React、Vue 3 项目类型
- 统一严格类型检查规则
- 支持 Deno 项目（`allowImportingTsExtensions`）

---

## 参与贡献

### 添加新配置

1. 创建新的 `.json` 文件
2. 更新 `package.json` 的 `exports` 字段
3. 在本 README 中添加文档说明

### 修改现有配置

请确保：
- 不破坏现有项目的兼容性
- 更新相关文档说明
- 在 Monorepo 中测试影响范围

---

## License

MIT © OpenCode
