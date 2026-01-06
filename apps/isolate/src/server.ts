import { type Context as HonoContext, Hono } from 'hono'
import type { Output } from './types.ts'
import { createIsolate, type Isolate } from './kernel.ts'

const app = new Hono()

let isolate: Isolate | null = null

async function getIsolate(): Promise<Isolate> {
  if (!isolate) {
    isolate = await createIsolate()
  }
  return isolate
}

app.post('/execute', async (c: HonoContext) => {
  const instance = await getIsolate()
  const out = (await instance.execute(await c.req.json())) as Output
  
  const large = out.logs?.some(
    log => log.level === 'exception' && log.name === 'PayloadTooLarge'
  )
  
  const code = large ? 413 : 200
  return c.json(out, code)
})

app.get('/health', (c: HonoContext) => {
  return c.json({ ok: true, timestamp: Date.now() })
})

if (import.meta.main) {
  const port = 8787
  console.log(`[isolate] Server starting on port ${port}`)
  Deno.serve({ port }, app.fetch)
}
