import { type Context as HonoContext, Hono } from 'hono'
import type { Output } from './types.ts'
import { create, type Isolate } from './kernel.ts'

const app = new Hono()

let instance: Isolate | null = null
const cache = new Map<string, { time: number; count: number }>();
const WINDOW = 1000;
const LIMIT = 10000;

async function isolate(): Promise<Isolate> {
  if (!instance) {
    instance = await create()
  }
  return instance
}

function purge(): void {
  const cutoff = Date.now() - 60000;
  for (const [key, val] of cache) {
    if (val.time < cutoff) cache.delete(key);
  }
}

async function hash(data: unknown): Promise<string> {
  const buffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(data))
  );
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function dedupe(key: string): boolean {
  const now = Date.now();
  const entry = cache.get(key);
  
  if (entry && now - entry.time < WINDOW) {
    return false;
  }
  
  cache.set(key, { time: now, count: (entry?.count ?? 0) + 1 });
  
  if (cache.size > LIMIT) {
    purge();
  }
  
  return true;
}

app.post('/execute', async (c: HonoContext) => {
  const body = await c.req.json();
  const key = await hash(body);

  if (!dedupe(key)) {
    return c.json({ error: 'Duplicate request' }, 429);
  }

  const engine = await isolate()
  const out = (await engine.execute(body)) as Output
  
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
  const server = Deno.serve({ port }, app.fetch)
  await server.finished
}
