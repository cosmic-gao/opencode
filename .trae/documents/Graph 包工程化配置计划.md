# Graph 包代码结构优化与配置方案

根据您的要求，我们将重点优化代码的模块化导出结构，并补全必要的包配置。

## 目标

1. **模块化导出 (Barrel Files)**：在每个功能子目录下创建 `index.ts`，统一管理该模块的对外暴露接口。
2. **入口简化**：重构根目录的 `src/index.ts`，使其仅通过子模块的 `index.ts` 进行导出，隐藏内部文件细节。
3. **包配置**：创建 `package.json` 以定义私有包环境。

## 详细实施计划

### 1. 补全子模块导出

为以下目录创建 `index.ts` 文件，集中导出该目录下的所有核心类与类型：

* **`src/model/index.ts`**: 导出 `Graph`, `Node`, `Edge`, `Endpoint`, `GraphDefinition` 等核心模型。

* **`src/subgraph/index.ts`**: 导出 `Subgraph` 及 `affectedSubgraph` 等算法函数。

* **`src/validate/index.ts`**: 导出 `validate`, `Diagnostic`, `Rule` 等校验逻辑。

* *(注:* *`lookup`,* *`workspace`,* *`delta`* *目录已包含 index.ts，无需创建)*

### 2. 重构根入口 `src/index.ts`

将原本冗长的文件级导出：

```typescript
export { Graph } from './model/graph'
export { Node } from './model/node'
// ...
```

简化为模块级导出：

```typescript
export * from './model'
export * from './lookup'
export * from './validate'
export * from './subgraph'
export * from './workspace'
export * from './delta'
```

这样做能显著提升代码的分层清晰度，外部调用者只需关注模块而非具体文件。

### 3. 创建 `package.json`

配置为私有源码包：

* `name`: `@opencode/graph`

* `private`: `true`

* `main`: `./src/index.ts`

* `scripts`: `check` (类型检查)

## 执行步骤

1. 创建 `package.json` 和 `.gitignore`。
2. 创建 `src/model/index.ts`。
3. 创建 `src/subgraph/index.ts`。
4. 创建 `src/validate/index.ts`。
5. 更新 `src/index.ts` 使用新的导出方式。
6. 运行类型检查验证重构无误。

