export type MaybePromise<T> = T | Promise<T>;

export type EventType = string | symbol;

export type Handler<T = unknown> = (event: T) => MaybePromise<void>;
export type WildcardHandler<E extends Record<EventType, any> = Record<string, unknown>> = (
  type: keyof E,
  event: E[keyof E]
) => MaybePromise<void>;

export type HandlerList<T = unknown> = Array<Handler<T>>;
export type WildcardHandlerList<E extends Record<EventType, any> = Record<string, unknown>> = Array<
  WildcardHandler<E>
>;

export type EventHandlerMap<E extends Record<EventType, any>> = Map<
  keyof E | '*',
  Array<Handler<E[keyof E]> | WildcardHandler<E>>
>;

export interface Emitter<E extends Record<EventType, any>> {
  all: EventHandlerMap<E>;

  on<K extends keyof E>(type: K, handler: Handler<E[K]>): () => void;
  on(type: '*', handler: WildcardHandler<E>): () => void;

  once<K extends keyof E>(type: K, handler: Handler<E[K]>): () => void;
  once(type: '*', handler: WildcardHandler<E>): () => void;

  off<K extends keyof E>(type: K, handler?: Handler<E[K]>): void;
  off(type: '*', handler?: WildcardHandler<E>): void;

  emit<K extends keyof E>(type: K, event: E[K]): void;
  emit<K extends keyof E>(type: undefined extends E[K] ? K : never): void;

  clear(): void;
}

/**
 * Signal: Functional event emitter / pubsub class implementation.
 * Renamed to EventBus in logic but kept as Signal class name for compatibility if needed,
 * or we can export both.
 */
export class Signal<E extends Record<EventType, any> = Record<string, unknown>> implements Emitter<E> {
  public all: EventHandlerMap<E> = new Map();

  constructor(all?: EventHandlerMap<E>) {
    if (all) this.all = all;
  }

  public on<K extends keyof E>(type: K | '*', handler: Handler<E[K]> | WildcardHandler<E>): () => void {
    const handlers = this.all.get(type) ?? [];
    handlers.push(handler as Handler<E[keyof E]> | WildcardHandler<E>);
    this.all.set(type, handlers);
    return () => this.off(type, handler);
  }

  public once<K extends keyof E>(type: K | '*', handler: Handler<E[K]> | WildcardHandler<E>): () => void {
    const off = this.on(type, (...args: unknown[]) => {
      off();
      const [typeOrEvent, event] = args;
      // Handle both wildcard and normal signatures
      // Wildcard: (type, event)
      // Normal: (event)
      
      // Implementation detail: emit calls handlers differently.
      // We need to match how the handler wrapper is called.
      // If type is '*', handler is WildcardHandler: (type, event) => void
      // If type is K, handler is Handler: (event) => void
      
      if (type === '*') {
         (handler as WildcardHandler<E>)(typeOrEvent as keyof E, event as E[keyof E]);
      } else {
         // args[0] is event
         (handler as Handler<E[K]>)(typeOrEvent as E[K]);
      }
    });
    return off;
  }

  public off<K extends keyof E>(type: K | '*', handler?: Handler<E[K]> | WildcardHandler<E>): void {
    const handlers = this.all.get(type);

    if (handlers) {
      if (handler) {
        const index = handlers.indexOf(handler as Handler<E[keyof E]> | WildcardHandler<E>) >>> 0;
        if (index > -1) handlers.splice(index, 1);
      }
      if (handlers.length === 0) this.all.delete(type);
    }
  }

  public emit<K extends keyof E>(type: K, event?: E[K]): void {
    this.all.get(type)?.slice().forEach((handler) => (handler as Handler<E[K]>)(event!));
    this.all.get('*')?.slice().forEach((handler) => (handler as WildcardHandler<E>)(type, event!));
  }

  public clear(): void {
    this.all.clear();
  }
}

export default Signal;
