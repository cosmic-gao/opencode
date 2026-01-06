import type { Reply, Packet, LogEntry } from './types.ts'

export function send(w: Worker, msg: Packet): void {
  w.postMessage(msg)
}

export function wait(w: Worker): Promise<Reply> {
  return new Promise((resolve) => {
    const logs: LogEntry[] = []
    
    const onMsg = (ev: MessageEvent) => {
      const msg = ev.data
      
      if (msg.type === 'log') {
        const log = msg.data as LogEntry
        logs.push(log)
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
    
    w.addEventListener('message', onMsg)
  })
}
