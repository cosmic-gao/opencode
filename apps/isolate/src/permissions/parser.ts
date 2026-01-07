export function parse(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const port = parsed.port || '5432';
    return `${host}:${port}`;
  } catch {
    return 'localhost:5432';
  }
}
