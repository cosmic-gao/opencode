import type { Next, Counter, CounterFn, Middleware, AsyncMiddleware, Pipeline, AsyncPipeline } from './types.ts'

export function createCounter<I, O>(fn: CounterFn<I, O>): Counter<I, O> {
  const dispatch = (index: number, input: I): O => {
    const next: Next<I, O> = (nextInput = input) => dispatch(index + 1, nextInput)
    return fn(index, input, next)
  }
  return { start: (input: I) => dispatch(0, input), dispatch }
}

export function createPipeline<I, O = I>(): Pipeline<I, O> {
  const list: Middleware<I, O>[] = []

  const use: Pipeline<I, O>['use'] = (...fns) => {
    list.push(...fns)
    return pipe
  }

  const run: Pipeline<I, O>['run'] = (input, options) => {
    const counter = createCounter<I, O>((i, v, next) => {
      if (i >= list.length) return options?.onLast ? options.onLast(v) : (v as unknown as O)
      const middleware = list[i]
      if (!middleware) return v as unknown as O
      return middleware(v, next)
    })
    return counter.start(input)
  }

  const middleware: Pipeline<I, O>['middleware'] = (input, next) => run(input, { onLast: next })

  const pipe: Pipeline<I, O> = { use, run, middleware }
  return pipe
}

export function createAsyncPipeline<I, O = I>(): AsyncPipeline<I, O> {
  const list: AsyncMiddleware<I, O>[] = []

  const use: AsyncPipeline<I, O>['use'] = (...fns) => {
    list.push(...fns)
    return pipe
  }

  const run: AsyncPipeline<I, O>['run'] = async (input, options) => {
    const counter = createCounter<I, Promise<O>>((i, v, next) => {
      if (i >= list.length) return options?.onLast ? options.onLast(v) : Promise.resolve(v as unknown as O)
      const middleware = list[i]
      if (!middleware) return Promise.resolve(v as unknown as O)
      return Promise.resolve(middleware(v, next))
    })
    return counter.start(input)
  }

  const middleware: AsyncPipeline<I, O>['middleware'] = (input, next) => run(input, { onLast: next })

  const pipe: AsyncPipeline<I, O> = { use, run, middleware }
  return pipe
}
