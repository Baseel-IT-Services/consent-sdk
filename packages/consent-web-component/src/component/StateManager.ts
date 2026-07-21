import type { WidgetTemplate } from '@baseel/types';

export type ComponentState = 'loading' | 'ready' | 'submitting' | 'success' | 'error';

export interface StateData {
  state: ComponentState;
  template?: WidgetTemplate;
  error?: string;
}

type Listener = (data: StateData) => void;

export class StateManager {
  private current: StateData = { state: 'loading' };
  private listeners: Listener[] = [];

  getState(): StateData {
    return this.current;
  }

  set(state: ComponentState, extras?: Partial<Omit<StateData, 'state'>>): void {
    this.current = { state, ...extras };
    this.listeners.forEach(fn => fn(this.current));
  }

  onChange(listener: Listener): void {
    this.listeners.push(listener);
  }

  offChange(listener: Listener): void {
    this.listeners = this.listeners.filter(fn => fn !== listener);
  }
}
