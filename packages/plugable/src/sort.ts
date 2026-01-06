import type {
    Hooks,
    Plugin,
    SortErrorInfo,
    SortErrorKind,
    SortResult,
} from "./types.ts";

export class PluginSortError extends Error {
    readonly kind: SortErrorKind;
    readonly plugins?: string[];
    constructor(err: SortErrorInfo) {
        super(err.message);
        this.name = "PluginSortError";
        this.kind = err.kind;
        this.plugins = err.plugins;
    }
}

function expand<H extends Hooks, C>(
    plugins: Plugin<H, C>[],
    seen = new Set<string>(),
): Plugin<H, C>[] {
    const result: Plugin<H, C>[] = [];
    for (const p of plugins) {
        if (seen.has(p.name)) continue;
        seen.add(p.name);
        if (p.usePlugins?.length) result.push(...expand(p.usePlugins, seen));
        result.push(p);
    }
    return result;
}

export function sort<H extends Hooks, C>(
    plugins: Plugin<H, C>[],
): SortResult<H, C> {
    const list = expand(plugins);
    const map = new Map<string, Plugin<H, C>>();
    for (const p of list) map.set(p.name, p);

    for (const p of list) {
        for (const r of p.required ?? []) {
            if (!map.has(r)) {
                throw new PluginSortError({
                    kind: "missing",
                    message: `Plugin "${p.name}" requires "${r}"`,
                    plugins: [p.name, r],
                });
            }
        }
    }

    const graph = new Map<string, Set<string>>();
    const degree = new Map<string, number>();
    for (const p of list) {
        graph.set(p.name, new Set());
        degree.set(p.name, 0);
    }

    for (const p of list) {
        for (const d of p.pre ?? []) {
            if (map.has(d)) {
                graph.get(d)!.add(p.name);
                degree.set(p.name, degree.get(p.name)! + 1);
            }
        }
        for (const d of p.post ?? []) {
            if (map.has(d)) {
                graph.get(p.name)!.add(d);
                degree.set(d, degree.get(d)! + 1);
            }
        }
    }

    const queue: string[] = [];
    const sorted: Plugin<H, C>[] = [];
    for (const [n, d] of degree) if (d === 0) queue.push(n);

    while (queue.length) {
        const cur = queue.shift()!;
        sorted.push(map.get(cur)!);
        for (const nb of graph.get(cur)!) {
            const nd = degree.get(nb)! - 1;
            degree.set(nb, nd);
            if (nd === 0) queue.push(nb);
        }
    }

    if (sorted.length !== list.length) {
        const cycle = list.filter((p) => !sorted.some((s) => s.name === p.name))
            .map((p) => p.name);
        throw new PluginSortError({
            kind: "cycle",
            message: `Circular: ${cycle.join(" → ")}`,
            plugins: cycle,
        });
    }

    return { sorted };
}

export function hasCycle<H extends Hooks, C>(plugins: Plugin<H, C>[]): boolean {
    try {
        sort(plugins);
        return false;
    } catch (e) {
        return e instanceof PluginSortError && e.kind === "cycle";
    }
}
