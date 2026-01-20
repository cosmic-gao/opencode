/**
 * 在微任务队列中执行回调
 * 
 * 优先使用原生 queueMicrotask，降级使用 Promise
 * @param callback 待执行的回调函数
 */
export const microtask = typeof queueMicrotask === 'function'
  ? queueMicrotask
  : (callback: () => void) => Promise.resolve().then(callback);
