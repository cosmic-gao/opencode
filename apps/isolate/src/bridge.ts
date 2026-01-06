import type { Reply, Packet, Entry } from './types.ts'

const MAX_LOGS = 1000;
const MAX_LOG_SIZE = 10000;

export function send(w: Worker, msg: Packet): void {
  w.postMessage(msg)
}

export function wait(w: Worker, signal?: AbortSignal): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const logs: Entry[] = []
    
    const onMsg = (ev: MessageEvent) => {
      const msg = ev.data
      
      if (msg.type === 'log') {
        const log = msg.data as Entry
        if (logs.length < MAX_LOGS) {
          const truncated = log.message.length > MAX_LOG_SIZE
            ? log.message.slice(0, MAX_LOG_SIZE) + '...[truncated]'
            : log.message;
          logs.push({ ...log, message: truncated });
        }
      } else if (msg.type === 'result') {
        w.removeEventListener('message', onMsg)
        const out = msg.data as Reply
        
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
