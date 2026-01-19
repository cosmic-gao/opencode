import type { Edge, Endpoint, Input, Node, Output } from '../../core/model'

/**
 * 图只读状态 (GraphState)
 *
 * 该接口用于在校验规则中抽象“事实源”，避免规则与具体存储实现（如 Store）产生强耦合。
 * 规则只允许通过该接口读取图结构，不允许直接修改状态。
 */
export interface GraphState {
  readonly metadata?: Record<string, unknown>

  getNode(nodeId: string): Node | undefined
  getEdge(edgeId: string): Edge | undefined
  hasNode(nodeId: string): boolean
  hasEdge(edgeId: string): boolean

  hasEndpoint(endpointId: string): boolean
  getEndpoint(endpointId: string): Endpoint | undefined
  getInput(endpointId: string): Input | undefined
  getOutput(endpointId: string): Output | undefined

  owner(endpointId: string): string | undefined
  endpoints(nodeId: string): readonly Endpoint[]

  readonly listNodes: IterableIterator<Node>
  readonly listEdges: IterableIterator<Edge>

  outgoing(nodeId: string): IterableIterator<Edge>
  incoming(nodeId: string): IterableIterator<Edge>
  inputEdges(inputId: string): IterableIterator<Edge>
  outputEdges(outputId: string): IterableIterator<Edge>
}

