import type { AppState } from '../types';

export interface AppBackend {
  loadState(): Promise<AppState>;
  saveState(state: AppState): Promise<void>;
  resetState(): Promise<AppState>;
}
