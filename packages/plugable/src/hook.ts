import type {
    APIHook,
    AsyncCollect,
    AsyncHook,
    AsyncMiddlewareFn,
    AsyncWaterfall,
    Collect,
    MiddlewareFn,
    SyncHook,
    Waterfall,
} from "./types.ts";
import { createAsyncPipeline, createPipeline } from "./pipeline.ts";

export function createSyncHook<T = unknown>(): SyncHook<T> {
    const pipe = createPipeline<T, T>();
    return {
        type: "sync" as const,
        tap: (fn) => {
            pipe.use((value, next) => {
                const result = fn(value);
                return result !== undefined ? next(result as T) : next(value);
            });
        },
        call: (value) => pipe.run(value),
        clear: () => {},
    };
}

export function createAsyncHook<T = unknown>(): AsyncHook<T> {
    const pipe = createAsyncPipeline<T, T>();
    return {
        type: "async" as const,
        tap: (fn) => {
            pipe.use(async (value, next) => {
                const result = await fn(value);
                return result !== undefined ? next(result as T) : next(value);
            });
        },
        call: (value) => pipe.run(value),
        clear: () => {},
    };
}

export function createWaterfall<T = unknown>(): Waterfall<T> {
    const pipe = createPipeline<T, T>();
    return {
        type: "waterfall" as const,
        tap: (fn: MiddlewareFn<T>) => {
            pipe.use(fn);
        },
        call: (value) => pipe.run(value),
        clear: () => {},
    };
}

export function createAsyncWaterfall<T = unknown>(): AsyncWaterfall<T> {
    const pipe = createAsyncPipeline<T, T>();
    return {
        type: "async-waterfall" as const,
        tap: (fn: AsyncMiddlewareFn<T>) => {
            pipe.use(fn);
        },
        call: (value) => pipe.run(value),
        clear: () => {},
    };
}

export function createCollect<T = unknown, R = unknown>(): Collect<T, R> {
    const pipe = createPipeline<T, R[]>();
    return {
        type: "collect" as const,
        tap: (fn) => {
            pipe.use((value, next) => {
                const results = next(value);
                const result = fn(value);
                if (result !== undefined) {
                    results.push(result as R);
                }
                return results;
            });
        },
        call: (value) => pipe.run(value, { onLast: () => [] as R[] }),
        clear: () => {},
    };
}

export function createAsyncCollect<T = unknown, R = unknown>(): AsyncCollect<
    T,
    R
> {
    const pipe = createAsyncPipeline<T, R[]>();
    return {
        type: "async-collect" as const,
        tap: (fn) => {
            pipe.use(async (value, next) => {
                const results = await next(value);
                const result = await fn(value);
                if (result !== undefined) {
                    results.push(result as R);
                }
                return results;
            });
        },
        call: (value) => pipe.run(value, { onLast: () => Promise.resolve([] as R[]) }),
        clear: () => {},
    };
}

export function createAPIHook<T = unknown>(): APIHook<T> {
    let api: T | undefined = undefined;

    return {
        type: "api" as const,
        provide: (value: T) => {
            if (api !== undefined) {
                throw new Error("API already provided");
            }
            api = value;
        },
        use: () => api,
        clear: () => {
            api = undefined;
        },
    };
}
