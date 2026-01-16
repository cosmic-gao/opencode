## 现状结论
- 当前 `src/adapter/html|css|javascript|typescript` 的 lexer/parser 都是“演示级子集”，距离 HTML Living Standard、CSS Syntax/Parsing、ECMAScript/TypeScript 规范级覆盖差距巨大（尤其错误恢复、状态机、完整 token 种类、表达式/语句/模块/TS 类型系统）。

## 目标定义（你说的“完整语言规范，自研”如何落地）
- 每门语言实现“规范级词法 + 规范级语法 + 错误恢复”，并通过官方/事实标准测试集验证：
  - HTML：tokenization + tree construction（HTML LS）
  - CSS：CSS Syntax Module + stylesheet/rule/declaration parsing 算法
  - JS：ECMAScript 语法（含模块）+ ASI 相关语义
  - TS：TypeScript 语法扩展 + TSX（作为事实标准）
- “自研”指：解析器实现完全由本仓库 TS 代码完成；但允许使用规范文档与公开测试集作为参考与验收标准。

## 总体架构（把适配器做“完整”但不污染 Parseo 核心）
### 1) 统一前端管线三段式
- Lexer：输入文本 → TokenStream（kind/category/value/span/loc + diagnostics）
- Parser：TokenStream → 语言 AST（语言自己的结构化 AST）
- Lowering（Adapter 映射）：语言 AST → Parseo `SyntaxNode[]`（用于 Parseo 后续建模/语义）

### 2) 目录拆分（避免继续在一个文件里堆状态机）
- `src/adapter/html/{lexer.ts,parser.ts,lowering.ts,index.ts}`
- `src/adapter/css/{lexer.ts,parser.ts,lowering.ts,index.ts}`
- `src/adapter/javascript/{lexer.ts,parser.ts,lowering.ts,index.ts}`
- `src/adapter/typescript/{lexer.ts,parser.ts,lowering.ts,index.ts}`（或 TS 复用 JS parser 的“扩展插槽”）

### 3) 关键共用基础设施（跨语言复用，但不强耦合）
- `src/adapter/shared/source.ts`：SourcePoint/SourceSpan 构造（已存在）
- `src/adapter/shared/diagnostics.ts`：常用诊断构造/合并策略（不要求新增文件名固定，可按现有风格）
- `src/adapter/shared/tokenStream.ts`：TokenStream 接口（peek/consume/expect/mark/reset，支持有限回溯与错误恢复同步点）

## 各语言实现策略（按规范正确性优先）
### HTML（必须按 HTML LS 的两阶段状态机）
- 实现 Tokenizer state machine（Data/RCDATA/RAWTEXT/ScriptData/…）
- 实现 Tree Builder insertion modes（in head/in body/table/…）+ 错误恢复
- 输出：DOM 等价树（Element/Text/Comment/Doctype），再 lowering 成 SyntaxNode

### CSS（先 tokenizer，再 rule/declaration 算法）
- Tokenizer：实现规范 token（ident/function/hash/at-keyword/string/url/number/dimension/percentage/delim/whitespace/comment/…）
- Parser：consume stylesheet → (at-rule|qualified rule)*；块内 consume declarations；完整错误恢复
- selectors/values：先 token 序列结构化，再逐步实现 selector AST 与 value AST

### JavaScript（规范级 lexer + Pratt 表达式 + 递归下降语句/模块）
- Lexer：template literal、regexp literal、unicode identifiers、numeric separators、bigint、hashbang/shebang、line terminator 追踪（支撑 ASI）
- Parser：Pratt 解析表达式 + 语句/声明/模块递归下降；提供同步点恢复（; } eof 等）
- JSX：作为可选模式（JSX/TSX）实现事实标准语法

### TypeScript（在 JS 之上做“语法扩展插槽”）
- 复用 JS lexer/parser 主体，在关键位置插入 TS 扩展分支：type annotations、type-only import/export、generics、enum/namespace、decorators、satisfies/as const 等
- TSX：词法/语法切换策略与 JSX 统一

## 测试与验收（没有测试就无法宣称“完整规范”）
- HTML：对接 html5lib/wpt 解析测试（裁剪为 parse-only 快照）
- CSS：wpt css-syntax + 自建 token/AST snapshot
- JS：test262（至少 parse-only 阶段）+ 自建回归用例
- TS：用 TypeScript 官方 parser 行为对照（输入→AST 形态对齐到你们的语言 AST，再做 lowering），并构建 TSX 回归集

## 交付顺序（确保每一步可运行可回归）
1) 抽象 shared TokenStream/诊断工具，适配器入口保持不变（`Adapter.parse`）
2) HTML：先 tokenizer，再 tree builder，替换现有 html 适配器
3) CSS：先 tokenizer，再 stylesheet/rule/declaration parser，替换现有 css 适配器
4) JS：lexer + parser（表达式/语句/模块），替换现有 js 适配器
5) TS：在 JS 基础上扩展，替换现有 ts 适配器
6) 增量扩大测试集与覆盖率，直到达到你定义的“完整规范”标准

## 不做的事（避免误解）
- 不引入第三方 parser/grammar 引擎（ANTLR/PEG 生成器）作为实现核心；实现保持“自研 TS 代码”。
- 不强行把语言 AST 直接变成 Parseo SyntaxNode 的细粒度 1:1 映射；降低耦合，通过 lowering 控制输出粒度。

如果你确认以上方向，我将从第 1 步开始改造：先搭好 TokenStream/diagnostics 基础与目录拆分，然后按 HTML→CSS→JS→TS 的顺序替换现有适配器，并同步补齐测试基线。