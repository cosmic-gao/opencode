import type { EndpointOptions, EndpointValue } from './endpoint'
import { Endpoint } from './endpoint'

/**
 * 输入端点 (Input)
 *
 * 表示节点接收数据的端口。
 * 边可以连接到输入端点，将数据传输给节点。
 */
export class Input extends Endpoint {
  constructor(options: EndpointOptions) {
    super(options)
  }

  /**
   * 从持久化结构创建输入端点。
   *
   * @param value - 端点持久化结构 (EndpointValue)
   * @returns 输入端点实例
   */
  static fromValue(value: EndpointValue): Input {
    return new Input(value)
  }
}
