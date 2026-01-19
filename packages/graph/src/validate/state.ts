import type { Edge, Endpoint, Input, Node, Output } from '../model'

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

  listNodes(): readonly Node[]
  listEdges(): readonly Edge[]

  outgoing(nodeId: string): readonly Edge[]
  incoming(nodeId: string): readonly Edge[]
  inputEdges(inputId: string): readonly Edge[]
  outputEdges(outputId: string): readonly Edge[]
}

