export type Next<I = unknown, O = unknown> = (input?: I) => O;

export type Middleware<I = unknown, O = unknown> = (
    input: I,
    next: Next<I, O>,
) => O;

export type AsyncMiddleware<I = unknown, O = unknown> = (
    input: I,
    next: Next<I, Promise<O>>,
) => O | Promise<O>;

export type CounterFn<I = unknown, O = unknown> = (
    index: number,
    input: I,
    next: Next<I, O>,
) => O;

export interface Counter<I = unknown, O = unknown> {
    start: (input: I) => O;
    dispatch: (index: number, input: I) => O;
}

export interface RunOptions<I = unknown, O = unknown> {
    onLast?: (input: I) => O;
}

export interface Pipeline<I = unknown, O = unknown> {
    use: (...middlewares: Middleware<I, O>[]) => Pipeline<I, O>;
    run: (input: I, options?: RunOptions<I, O>) => O;
    middleware: Middleware<I, O>;
}

export interface AsyncPipeline<I = unknown, O = unknown> {
    use: (...middlewares: AsyncMiddleware<I, O>[]) => AsyncPipeline<I, O>;
    run: (input: I, options?: RunOptions<I, Promise<O>>) => Promise<O>;
    middleware: AsyncMiddleware<I, O>;
}

export type Callback<T = unknown, R = T> = (value: T) => R | void;

export type AsyncCallback<T = unknown, R = T> = (
    value: T,
) => R | void | Promise<R | void>;

export type MiddlewareFn<T = unknown> = (value: T, next: Next<T, T>) => T;

export type AsyncMiddlewareFn<T = unknown> = (
    value: T,
    next: Next<T, Promise<T>>,
) => T | Promise<T>;

export interface Hook {
    clear: () => void;
    readonly type: string;
}

export interface SyncHook<T = unknown> extends Hook {
    tap: (fn: Callback<T, T>) => void;
    call: (value: T) => T;
    readonly type: "sync";
}

export interface AsyncHook<T = unknown> extends Hook {
    tap: (fn: AsyncCallback<T, T>) => void;
    call: (value: T) => Promise<T>;
    readonly type: "async";
}

export interface Waterfall<T = unknown> extends Hook {
    tap: (fn: MiddlewareFn<T>) => void;
    call: (value: T) => T;
    readonly type: "waterfall";
}

export interface AsyncWaterfall<T = unknown> extends Hook {
    tap: (fn: AsyncMiddlewareFn<T>) => void;
    call: (value: T) => Promise<T>;
    readonly type: "async-waterfall";
}

export interface Collect<T = unknown, R = unknown> extends Hook {
    tap: (fn: Callback<T, R>) => void;
    call: (value: T) => R[];
    readonly type: "collect";
}

export interface AsyncCollect<T = unknown, R = unknown> extends Hook {
    tap: (fn: AsyncCallback<T, R>) => void;
    call: (value: T) => Promise<R[]>;
    readonly type: "async-collect";
}

export interface APIHook<T = unknown> extends Hook {
    provide: (api: T) => void;
    use: () => T | undefined;
    readonly type: "api";
}

export type AnyHook =
    | SyncHook<any>
    | AsyncHook<any>
    | Waterfall<any>
    | AsyncWaterfall<any>
    | Collect<any, any>
    | AsyncCollect<any, any>
    | APIHook<any>;

export type Hooks = Record<string, AnyHook>;

export type PluginAPI<H extends Hooks = Hooks, C = unknown> = H & {
    context: () => C;
    setContext: (partial: Partial<C>) => void;
    exists: (name: string) => boolean;
    getPlugin: (name: string) => Plugin<H, C> | undefined;
};

export interface Plugin<H extends Hooks = Hooks, C = unknown> {
    name: string;
    pre?: string[];
    post?: string[];
    required?: string[];
    usePlugins?: Plugin<H, C>[];
    registryHook?: Partial<Hooks>;
    setup: (api: PluginAPI<H, C>) => void | Promise<void>;
}

export interface ManagerOptions<H extends Hooks = Hooks, C = unknown> {
    hooks: H;
    context?: C;
}

export interface Manager<H extends Hooks = Hooks, C = unknown> {
    use: (plugin: Plugin<H, C> | Plugin<H, C>[]) => Manager<H, C>;
    init: (context?: Partial<C>) => Promise<void>;
    getHooks: () => H & Hooks;
    getContext: () => C;
    setContext: (partial: Partial<C>) => void;
    exists: (name: string) => boolean;
    getPlugin: (name: string) => Plugin<H, C> | undefined;
    getNames: () => string[];
}

export interface SortResult<H extends Hooks = Hooks, C = unknown> {
    sorted: Plugin<H, C>[];
    cycle?: string[];
}

export type SortErrorKind = "cycle" | "missing";

export interface SortErrorInfo {
    kind: SortErrorKind;
    message: string;
    plugins?: string[];
}
