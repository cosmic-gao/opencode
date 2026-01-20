import { nanoid } from "nanoid";

export const SCOPE_ALPHABET = "__opencode_grid__"

/**
 * 创建带作用域前缀的 ID 生成器
 * @param scope ID 前缀作用域
 * @returns ID 生成函数
 */
export const withIdScope = (scope: string = SCOPE_ALPHABET) =>
    (size: number = 12): string => `${scope}${nanoid(size)}`;

/**
 * 创建唯一 ID
 * @param size ID 长度（默认 12）
 * @returns 唯一 ID 字符串
 */
export const createId = withIdScope();
