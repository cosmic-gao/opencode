# Parseo 架构说明

Parseo 是一个面向 DSL 的微内核平台：核心保持稳定，只提供解析、建模与运行能力；DSL 语义通过可插拔扩展实现。

## 设计目标

- 核心稳定：解析与中立模型保持简单、可复用
- 能力可插拔：通过构建器与语义插件扩展 DSL 能力
- 低耦合：解析/建模/语义相互隔离，只通过稳定接口通信
- 强类型与可诊断：对外 API 不依赖异常作为控制流，诊断信息可追踪到源位置

## 模块分层

Parseo 按“输入 → 语法 → 中立模型 → 语义”组织：

- syntax：源位置（span）与诊断（diagnostic），为全链路提供统一错误载体
- parser：将文本解析成 SyntaxNode（只关心结构，不关心语义）
- neutral：NeutralDocument/Entity/Link，是可被多 DSL/多语义共享的中立模型
- model：ModelBuilder 将 SyntaxNode 转换为 NeutralDocument；linker 校验引用关系；registry/loader 提供可插拔机制
- semantic：SemanticPlugin 定义语义扩展点；runner 提供依赖排序与执行；loader 支持动态加载

对应源码目录可直接从 [src/index.ts](file:///e:/opencode/packages/parseo/src/index.ts) 的导出看到模块边界。

## 核心数据结构

### SyntaxNode（语法树）

语法层只表达结构：`type/name/attrs/children/span/loc`。解析器不做领域校验，也不做引用解析。

- 入口：`parseText(text)` → `ParseResult`
- 文件：src/parser + src/syntax

### NeutralDocument（中立模型）

中立模型提供跨 DSL 的统一表达：

- `entities[]`：以 `type/name` 唯一标识的实体（例如 flow、node）
- `links[]`：实体间的关系（例如 edge from→to）
- `meta/tags`：为扩展保存额外信息；meta 通过命名空间隔离（MetaManager）

这样做的好处是：

- 同一个 DSL 可有多套语义插件复用同一份模型
- 不同 DSL 也可共享同一套语义插件（只要模型约定一致）

## 扩展点

### 1) ModelBuilder（建模扩展点）

构建器负责把 SyntaxNode 转换为 NeutralDocument。它是新增 DSL 能力的第一扩展点。

- 接口：`ModelBuilder`（name/supports/build）
- 运行方式：调用方自行遍历 SyntaxNode 并调用 builder.build
- 动态加载：`loadBuilder(source, rule)` 支持模块/函数/对象形式

约束：

- build 不应产生跨模块副作用
- 不应把“语义计算”塞进 builder；builder 只做结构映射与基本归一化

### 2) SemanticPlugin（语义扩展点）

语义插件对 NeutralDocument 做解释：校验、推导、生成、执行等都属于语义层。

- 接口：`SemanticPlugin`（name/supports/prepare/run + 依赖字段）
- 执行器：`SemanticRunner` 负责依赖排序与运行
- 动态加载：`loadPlugin(source, rule)`

依赖字段说明：

- `required`：强依赖，缺失时排序/运行会失败
- `before/after`：软约束，用于调整执行顺序

## 推荐数据流

1. `tokenizeText`：文本 → tokens（可含 tokenize 诊断）
2. `parseText`：tokens → SyntaxNode[]（可含 parse 诊断）
3. `ModelBuilder.build`：SyntaxNode → NeutralDocument（可把构建期诊断写入 context）
4. `linkDocument`：NeutralDocument → 引用校验诊断
5. `SemanticRunner.run/runAll`：NeutralDocument → 语义结果（不以抛异常作为正常控制流）

## 边界与约束

- 解析器只做结构：不引入业务规则、不做引用解析
- 中立模型只表达事实：语义计算放在 semantic 插件内
- 扩展必须通过接口进入：禁止跨层直接调用内部实现
- 诊断优先：尽量返回 diagnostics，而不是在核心路径抛异常

## 如何新增一个 DSL（简要）

1. 设计 SyntaxNode 的 type/name/attrs 约定
2. 新增一个 ModelBuilder，把节点映射为 NeutralDocument
3. 根据需要实现 SemanticPlugin（校验/生成/执行等）
4. 通过 loader 动态加载或 runner/builder registry 注册

