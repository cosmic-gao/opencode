export const microtask = typeof queueMicrotask === 'function'
  ? queueMicrotask
  : (callback: () => void) => Promise.resolve().then(callback);
