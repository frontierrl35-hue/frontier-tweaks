import type { FrontierApi } from '../../preload/preload';

declare global {
  interface Window {
    frontier: FrontierApi;
  }
}

export {};
