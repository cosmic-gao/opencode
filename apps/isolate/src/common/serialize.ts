function isArrayLike(value: unknown): value is ArrayLike<unknown> {
  if (value == null || Array.isArray(value)) {
    return false;
  }
  
  if (typeof value !== 'object') {
    return false;
  }
  
  const hasLength = 'length' in value;
  if (!hasLength) {
    return false;
  }
  
  const length = (value as { length: unknown }).length;
  return typeof length === 'number' && length >= 0 && Number.isInteger(length);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value == null || typeof value !== 'object') {
    return false;
  }
  
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

export function serialize(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value == null) {
    return value;
  }
  
  if (typeof value !== 'object') {
    if (typeof value === 'bigint') {
      return { _bigint: value.toString() };
    }
    return value;
  }
  
  if (seen.has(value)) {
    return null;
  }
  seen.add(value);
  
  if (value instanceof Date) {
    return value;
  }
  
  if (value instanceof ArrayBuffer) {
    return value;
  }
  
  if (ArrayBuffer.isView && ArrayBuffer.isView(value)) {
    return value;
  }
  
  if (isArrayLike(value)) {
    return Array.from(value).map((item) => serialize(item, seen));
  }
  
  if (Array.isArray(value)) {
    return value.map((item) => serialize(item, seen));
  }
  
  if (value instanceof Map) {
    const result: Record<string, unknown> = {};
    for (const [k, v] of value.entries()) {
      const key = typeof k === 'string' ? k : String(k);
      result[key] = serialize(v, seen);
    }
    return result;
  }
  
  if (value instanceof Set) {
    return Array.from(value).map((item) => serialize(item, seen));
  }
  
  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = serialize(val, seen);
    }
    return result;
  }
  
  try {
    const json = JSON.stringify(value);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function deserialize(value: unknown): unknown {
  if (value == null || typeof value !== 'object') {
    return value;
  }
  
  if ('_bigint' in value && typeof (value as { _bigint: unknown })._bigint === 'string') {
    try {
      return BigInt((value as { _bigint: string })._bigint);
    } catch {
      return value;
    }
  }
  
  if (Array.isArray(value)) {
    return value.map((item) => deserialize(item));
  }
  
  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = deserialize(val);
    }
    return result;
  }
  
  return value;
}

export function hydrate(result: unknown, columns: readonly { name: string }[]) {
  const names = columns.map((c) => c.name);
  const count = names.length;

  if (!Array.isArray(result) || count === 0) {
    return [];
  }

  const rows = new Array(result.length);

  for (let r = 0; r < result.length; r++) {
    const row = result[r] as Record<string, unknown>;
    const data = new Array(count);

    for (let c = 0; c < count; c++) {
      data[c] = row[names[c]];
    }

    rows[r] = data;
  }
  console.log(rows, "hydrated rows")
  return rows;
}
