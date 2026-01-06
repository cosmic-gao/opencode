/**
 * 工具定义接口
 */
export interface Tool {
  /**
   * 工具名称（用于标识）
   */
  name: string
  
  /**
   * 工具描述
   */
  description?: string
  
  /**
   * 工具实现函数
   * 在隔离环境中注入全局对象或功能
   */
  setup: (globals: Record<string, unknown>) => void
}

/**
 * 工具注册表
 */
export interface Registry {
  [key: string]: Tool
}
