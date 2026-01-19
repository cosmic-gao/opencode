# @opencode/graph

以不可变 `Graph` 为核心，通过 `Workspace` 提供事务化的唯一写入口；通过 `Patch` 表达事实变更；通过校验产出 `Diagnostic` 并在失败时回滚状态。

## 推荐用法

```ts
import { Graph, Node, Workspace } from '@opencode/graph'

const graph = new Graph({ nodes: [], edges: [] })
const workspace = new Workspace(graph)

const result = workspace.update((editor) => {
  editor.createNode(new Node({ id: 'n1', type: 'task', inputs: [], outputs: [] }))
})

result.graph
result.patch
result.diagnostics
```

## 完整示例

请参考 [examples/usage.ts](./examples/usage.ts) 查看包含定义、编辑、校验、查询和序列化的完整演示。

## 不变式

- `Graph` 是不可变快照：变更通过生成新快照表达。
- `Workspace.update` 是唯一写入口：在事务中应用 `Patch`，校验失败则回滚。
- `Patch` 只描述事实层变更（新增/替换/移除），不表达意图。

## 校验

在 `Workspace.update/apply` 中默认执行增量校验；也可以对不可变快照执行全量校验：

```ts
import { validateGraph } from '@opencode/graph'

const diagnostics = validateGraph(graph, { matchFlow: true })
```

### 自定义规则

`ValidateOptions.rules` 支持传入自定义 `Rule`。规则依赖的是只读 `GraphState` 抽象，不绑定具体存储实现。

```ts
import type { Rule } from '@opencode/graph'

export const noIsolatedNodeRule = (): Rule => ({
  name: 'no-isolated-node',
  evaluate(state) {
    const diagnostics = []
    for (const node of state.listNodes) {
      const incoming = [...state.incoming(node.id)]
      const outgoing = [...state.outgoing(node.id)]
      if (incoming.length === 0 && outgoing.length === 0) {
        diagnostics.push({
          level: 'warning',
          code: 'no-isolated-node',
          message: `Isolated node: ${node.id}`,
          target: { type: 'node', id: node.id },
        })
      }
    }
    return diagnostics
  },
})
```

## 架构分层

- `model`：领域对象与序列化（不可变结构）
- `workspace`：用例层/事务边界（唯一写入口）
- `validate`：规则与诊断（仅依赖只读 `GraphState` 与 `Patch`）
- `lookup`：查询索引（`Lookup` 为不可变索引）
- `state`、`validate/rules`、`lookup/incremental`：内部实现细节，不作为稳定对外契约
