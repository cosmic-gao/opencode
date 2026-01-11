import type { Reply, Packet, Entry } from './types.ts'

const MAX_LOGS = 1000;
const MAX_LOG_SIZE = 10000;

export function send(w: Worker, msg: Packet): void {
  w.postMessage(msg)
}

export function wait(w: Worker, signal?: AbortSignal): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const logs: Entry[] = []
    let dropped = 0;
    
    const onMsg = (ev: MessageEvent) => {
      const msg = ev.data
      if (msg.type === 'log') {
        const log = msg.data as Entry
        if (logs.length < MAX_LOGS) {
          let message = log.message;
          if (message.length > MAX_LOG_SIZE) {
            const truncatedBytes = message.length - MAX_LOG_SIZE;
            message = message.slice(0, MAX_LOG_SIZE) + `...[truncated ${truncatedBytes} chars]`;
          }
          logs.push({ ...log, message });
        } else {
          dropped++;
        }
      } else if (msg.type === 'result') {
        w.removeEventListener('message', onMsg)
        const out = msg.data as Reply
        
        if (dropped > 0) {
          logs.push({
            level: 'warn',
            message: `[${dropped} log entries dropped due to limit]`,
            timestamp: Date.now(),
          });
        }
        
        const reply: Reply = { ...out }
        if (logs.length > 0) {
          reply.logs = logs
        }
        
        resolve(reply)
      }
    }
    
    if (signal) {
      signal.addEventListener('abort', () => {
        w.removeEventListener('message', onMsg)
        reject(new Error('Aborted'))
      })
    }
    
    w.addEventListener('message', onMsg)
  })
}
