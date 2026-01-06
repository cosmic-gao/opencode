import type {
    AnyHook,
    Hooks,
    Manager,
    ManagerOptions,
    Plugin,
    PluginAPI,
} from "./types.ts";
import { sort } from "./sort.ts";

export function createManager<H extends Hooks, C extends object = object>(
    options: ManagerOptions<H, C>,
): Manager<H, C> {
    const plugins = new Map<string, Plugin<H, C>>();
    let hooks: H & Hooks = { ...options.hooks };
    let ctx: C = (options.context ?? {}) as C;
    let ready = false;

    const use: Manager<H, C>["use"] = (p) => {
        if (ready) throw new Error("Already initialized");
        const list = Array.isArray(p) ? p : [p];
        for (const item of list) {
            if (!plugins.has(item.name)) plugins.set(item.name, item);
        }
        return mgr;
    };

    const init: Manager<H, C>["init"] = async (initial) => {
        if (ready) throw new Error("Already initialized");
        if (initial) ctx = { ...ctx, ...initial };

        const { sorted } = sort(Array.from(plugins.values()));

        for (const p of sorted) {
            if (p.registryHook) {
                for (const [k, v] of Object.entries(p.registryHook)) {
                    if (!(k in hooks)) {
                        (hooks as Record<string, AnyHook>)[k] = v as AnyHook;
                    }
                }
            }
        }

        const api: PluginAPI<H, C> = {
            ...hooks,
            context: () => ctx,
            setContext: (partial) => {
                ctx = { ...ctx, ...partial };
            },
            exists: (n) => plugins.has(n),
            getPlugin: (n) => plugins.get(n),
        };

        for (const p of sorted) await p.setup(api);
        ready = true;
    };

    const mgr: Manager<H, C> = {
        use,
        init,
        getHooks: () => hooks,
        getContext: () => ctx,
        setContext: (partial) => {
            ctx = { ...ctx, ...partial };
        },
        exists: (n) => plugins.has(n),
        getPlugin: (n) => plugins.get(n),
        getNames: () => Array.from(plugins.keys()),
    };

    return mgr;
}
