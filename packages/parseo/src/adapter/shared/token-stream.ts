export interface TokenStream<T> {
  peek(offset?: number): T | undefined
  advance(): T | undefined
  position(): number
  reset(position: number): void
}

export class ArrayTokenStream<T> implements TokenStream<T> {
  private index = 0
  private readonly tokens: readonly T[]

  constructor(tokens: readonly T[]) {
    this.tokens = tokens
  }

  peek(offset = 0): T | undefined {
    return this.tokens[this.index + offset]
  }

  advance(): T | undefined {
    const value = this.tokens[this.index]
    this.index += 1
    return value
  }

  position(): number {
    return this.index
  }

  reset(position: number): void {
    this.index = Math.max(0, position)
  }
}

