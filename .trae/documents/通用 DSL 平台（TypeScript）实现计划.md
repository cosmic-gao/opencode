## 命名与落点
- 新增包名：packages/parseo（对外包名建议 @opencode/parseo）
- 新代码命名遵循“完整英文单词、1–2 词”为主，类型名避免 AST/IR 缩写。

## 目标与边界
- 内核能力：文本 → 语法树（SyntaxNode）→ 中立文档（NeutralDocument）→ 可插拔语义（执行/校验/生成/仿真）。
- 核心稳定：Parser + SyntaxNode + NeutralDocument 是稳定内核；扩展通过 builder/semantic 插件实现。

## 新增：Meta/Tag 系统（未来扩展不破坏核心）
- 设计目标
  - 插件可附加上下文/属性而不修改核心字段
  - 避免插件间字段冲突（强制命名空间）
  - 可序列化（便于缓存、跨进程传递、代码生成）
- 核心结构追加（稳定字段）
  - SyntaxNode 增加：meta、tags
  - NeutralEntity/NeutralLink/NeutralDocument 增加：meta、tags
- Meta API（建议提供统一封装，避免直接写对象）
  - MetaStore：
    - set(ownerName, key, value)
    - get(ownerName, key)
    - list(ownerName)
  - ownerName 必须等于插件 name（或 builder name），保证命名空间隔离。
- Tag 语义
  - tags 用于轻量分类/路由（例如 semantic supports 基于 tag）
  - tag 只允许 string，禁止承载复杂对象（复杂信息放 meta）

## 新增：Runner 动态加载外部插件（平台动态可扩展）
- 目标
  - 支持在 apps/packages 新增扩展包后，无需修改 parseo 内核即可加载
  - 支持运行时按配置加载（例如 CLI/服务端读取配置）
- 插件来源抽象
  - PluginSource = string | URL | (() => Promise<SemanticPlugin | ModelBuilder>) | { load(): Promise<...> }
- 加载策略
  - string：按 Node 的模块解析规则动态 import（支持 workspace 依赖）
  - URL：import(url.href)
  - factory：直接 await
- 安全与可控
  - 仅允许加载白名单前缀（例如 @opencode/parseo-plugin-* 或业务指定前缀）作为默认策略
  - 加载失败输出结构化诊断（module、reason、stack 可选）
- 可加载内容
  - SemanticPlugin（执行语义）
  - ModelBuilder（语法树 → 中立文档扩展）

## 与现有仓库的贴合点
- 语义调度优先复用：[@opencode/plugable](file:///e:/opencode/packages/plugable/src) 的拓扑排序与 Hook 管线
  - 将 SemanticRunner 实现为 plugable manager 的一组 hooks：onRegister/onPrepare/onRun
  - 插件依赖用 plugable 的 sort 机制表达（depends/before/after）

## 包结构（packages/parseo）
- src/parser/（稳定）
  - tokenizer.ts（Token、Span、Diagnostic）
  - parser.ts（TextParser：Text → SyntaxNode[]）
- src/syntax/（稳定）
  - node.ts（SyntaxNode：kind/name/attrs/children/span/meta/tags）
  - diagnostic.ts（Diagnostic、错误码、格式化）
- src/neutral/（稳定）
  - document.ts（NeutralDocument：entities/links/meta/tags）
  - entity.ts（NeutralEntity、NeutralLink、Reference、MetaStore）
- src/model/（可扩展点 1）
  - builder.ts（ModelBuilder：SyntaxNode → NeutralDocument）
  - registry.ts（builder 注册表、冲突与合并策略）
  - linker.ts（引用解析：把连接与实体引用对齐）
  - loader.ts（动态加载 builder）
- src/semantic/（可扩展点 2）
  - plugin.ts（SemanticPlugin：supports/prepare/run + meta/tags 约定）
  - runner.ts（SemanticRunner：注册/选择/运行 + 依赖排序）
  - loader.ts（动态加载 semantic 插件）
- src/index.ts

## 语法与解析器设计（解析器不随业务变化）
- 通用文法：解析器只理解“标识符、箭头、花括号、键值对”，不绑定 flow/node/edge 等关键字。
  - Statement：`<kind> <name?> <attrList?>`
  - Block：`<kind> <name?> <attrList?> { <statement>* }`
  - Link：`<kind> <from> -> <to> <attrList?>`
  - attrList：`key=value`（string/number/boolean）
- 输出统一带 span 与 diagnostic，供验证与 IDE 使用。

## ModelBuilder 扩展机制
- builder.supports(node) 决定处理范围；builder.build(node, store) 产出中立片段
- 独立 linker 阶段做引用解析与一致性修复
- builder 可通过 meta/tags 写入扩展信息，不修改 NeutralDocument 结构

## 语义插件系统
- 语义接口
  - name
  - supports(document)
  - prepare?(document)
  - run(document, context)
- Runner
  - register(plugin)
  - load(source) 动态加载
  - run(name, document, context)
  - runAll(document, context, filter?)（可选：按 tags 或配置批量执行）
- 错误类型统一：ParseError/ModelError/SemanticError，携带 span 与诊断。

## 首批内置能力（验证架构可行）
- FlowBuilder：把 `flow/node/edge` kind 映射为 NeutralDocument 的实体与连接（只表达事实）
- 三个语义插件：Validation / StateMachine / CodeGen
- 示例：从文本解析到 NeutralDocument，再动态加载/运行语义

## 工程与验证
- 单元测试：parser（span/错误恢复）、builder（flow 样例）、runner（动态加载的 mock 插件、依赖排序）、meta/tag 行为
- 约束：显式边界与异常处理；函数 ≤50 行、嵌套 ≤3 层

## 交付物
- packages/parseo（可被 apps/packages 引用）
- 最小示例：解析 DSL → 构建 NeutralDocument → 动态加载插件 → 运行 validation/state-machine/codegen