import type { EndpointOptions, EndpointValue } from './endpoint'
import { Endpoint } from './endpoint'

/**
 * 输出端点 (Output)
 *
 * 表示节点发送数据的端口。
 * 边可以从输出端点发出，将数据传输给其他节点。
 */
export class Output extends Endpoint {
  constructor(options: EndpointOptions) {
    super(options)
  }

  /**
   * 从持久化结构创建输出端点。
   *
   * @param value - 端点持久化结构 (EndpointValue)
   * @returns 输出端点实例
   */
  static fromValue(value: EndpointValue): Output {
    return new Output(value)
  }
}
