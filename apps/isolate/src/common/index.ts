export { proxy, read } from './proxy.ts';
export { lazy } from './lazy.ts';
export { inject, provide, track, reset } from './inject.ts';
export { index, setup, install, mount, unmount } from './tools.ts';
export { fault, bust, stringify } from './utils.ts';
export { freeze, isFrozen, verifyFreeze } from './freeze.ts';
export { parse, extract } from './parser.ts';
export { build, resolve } from './builder.ts';

export type { ProxyOptions } from './proxy.ts';
export type { ParsedSpec } from './parser.ts';
