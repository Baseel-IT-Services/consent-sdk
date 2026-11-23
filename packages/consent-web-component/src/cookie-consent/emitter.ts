import type { CookieConsentEvent, CookieConsentEventMap } from './types.js';

type Handler<K extends CookieConsentEvent> = (data: CookieConsentEventMap[K]) => void;

/**
 * Event emitter where `consentReady` is sticky: a listener added after it fired is
 * called straight away with the current state, so script order mistakes don't lose the signal.
 */
export class ConsentEmitter {
  private handlers: { [K in CookieConsentEvent]?: Set<Handler<K>> } = {};
  private readyState: CookieConsentEventMap['consentReady'] | null = null;

  constructor(private readonly onHandlerError: (event: string, err: unknown) => void) {}

  on<K extends CookieConsentEvent>(event: K, handler: Handler<K>): void {
    if (typeof handler !== 'function') return;
    let set = this.handlers[event] as Set<Handler<K>> | undefined;
    if (!set) {
      set = new Set();
      (this.handlers as Record<string, Set<Handler<K>>>)[event] = set;
    }
    set.add(handler);
    if (event === 'consentReady' && this.readyState) {
      this.call(event, handler as Handler<'consentReady'>, this.readyState);
    }
  }

  off<K extends CookieConsentEvent>(event: K, handler: Handler<K>): void {
    (this.handlers[event] as Set<Handler<K>> | undefined)?.delete(handler);
  }

  emit<K extends CookieConsentEvent>(event: K, data: CookieConsentEventMap[K]): void {
    if (event === 'consentReady') this.readyState = data as CookieConsentEventMap['consentReady'];
    const set = this.handlers[event] as Set<Handler<K>> | undefined;
    if (!set) return;
    for (const handler of [...set]) this.call(event, handler, data);
  }

  /** Keeps the replayed state current after the user changes their choice. */
  updateReadyState(state: CookieConsentEventMap['consentReady']): void {
    if (this.readyState) this.readyState = state;
  }

  clear(): void {
    this.handlers = {};
    this.readyState = null;
  }

  private call<K extends CookieConsentEvent>(event: K, handler: Handler<K>, data: CookieConsentEventMap[K]): void {
    try {
      handler(data);
    } catch (err) {
      this.onHandlerError(event, err);
    }
  }
}
