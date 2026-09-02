import { SdkEventMap } from '@baseel-sdk/types';

export class EventEmitter {
  private listeners: { [K in keyof SdkEventMap]?: Array<(data: SdkEventMap[K]) => void> } = {};

  public on<K extends keyof SdkEventMap>(event: K, handler: (data: SdkEventMap[K]) => void): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event]!.push(handler);
  }

  public off<K extends keyof SdkEventMap>(event: K, handler: (data: SdkEventMap[K]) => void): void {
    const list = this.listeners[event];
    if (!list) return;

    this.listeners[event] = list.filter((h) => h !== handler) as any;
  }

  public emit<K extends keyof SdkEventMap>(event: K, data: SdkEventMap[K]): void {
    const list = this.listeners[event];
    if (!list) return;

    for (const handler of list) {
      try {
        handler(data);
      } catch (err) {
        console.error(`[Baseel SDK] Error in event listener for "${String(event)}":`, err);
      }
    }
  }

  public clear(): void {
    this.listeners = {};
  }
}
