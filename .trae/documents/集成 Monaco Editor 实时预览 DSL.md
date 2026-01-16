# 集成 Monaco Editor 实现实时 DSL 解析预览

## 目标
在示例页面中集成 Monaco Editor，提供多语言 DSL 示例切换，并实现编辑器内容变更时的实时解析与 AST 结构展示。

## 步骤

### 1. 依赖安装
- 安装 `monaco-editor` 作为开发依赖。

### 2. 重构页面布局 (`examples/index.html`)
- 修改页面结构，移除旧的 `#app` 内容。
- 添加顶部工具栏：包含标题和“示例选择”下拉菜单（选项：HTML, TypeScript, JavaScript, Vue）。
- 添加主内容区域：使用 Flex 布局实现左右分屏。
  - 左侧：`#editor-container`（Monaco Editor 挂载点）。
  - 右侧：`#output-container`（解析结果展示区）。

### 3. 实现核心逻辑 (`examples/main.ts`)
- **引入 Monaco Editor**：导入核心模块。
- **配置 Worker**：利用 Parcel 的 Worker 支持配置 `MonacoEnvironment`，确保编辑器核心功能正常加载。
- **定义示例数据**：
  - `HTML`: 展示用 DSL 描述 HTML 结构的示例。
  - `TypeScript`: 展示用 DSL 描述类型定义的示例。
  - `JavaScript`: 展示用 DSL 描述逻辑流的示例。
  - `Vue`: 展示用 DSL 描述组件结构的示例。
- **初始化编辑器**：
  - 创建 Monaco 实例。
  - 设置默认语言高亮（虽然是自定义 DSL，暂使用近似语言或纯文本高亮，或简单的自定义高亮配置）。
- **实现实时解析**：
  - 监听 `onDidChangeModelContent` 事件。
  - 获取编辑器文本 -> 调用 `parseText` -> 格式化 JSON -> 更新右侧视图。
- **实现示例切换**：
  - 监听下拉菜单变化，更新编辑器内容，并自动触发解析。

### 4. 验证
- 启动开发服务器。
- 验证编辑器加载是否正常。
- 验证输入文本是否实时更新右侧 AST。
- 验证下拉菜单切换是否正常工作。
