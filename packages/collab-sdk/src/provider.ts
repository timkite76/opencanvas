import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import type { UserAwareness, AwarenessState } from './awareness.js';

export class CollabProvider {
  private ydoc: Y.Doc;
  private wsProvider: WebsocketProvider;
  private syncCallbacks: Array<() => void> = [];
  private updateCallbacks: Array<(update: Uint8Array) => void> = [];
  private destroyed = false;

  constructor(docId: string, wsUrl: string) {
    this.ydoc = new Y.Doc();
    this.wsProvider = new WebsocketProvider(wsUrl, docId, this.ydoc, {
      connect: false,
    });

    this.wsProvider.on('sync', (isSynced: boolean) => {
      if (isSynced) {
        for (const cb of this.syncCallbacks) {
          cb();
        }
      }
    });

    this.ydoc.on('update', (update: Uint8Array, origin: unknown) => {
      // Only fire for remote updates (origin is the wsProvider for remote changes)
      if (origin === this.wsProvider) {
        for (const cb of this.updateCallbacks) {
          cb(update);
        }
      }
    });
  }

  connect(): void {
    if (!this.destroyed) {
      this.wsProvider.connect();
    }
  }

  disconnect(): void {
    this.wsProvider.disconnect();
  }

  getYDoc(): Y.Doc {
    return this.ydoc;
  }

  getAwareness(): WebsocketProvider['awareness'] {
    return this.wsProvider.awareness;
  }

  onSync(callback: () => void): void {
    this.syncCallbacks.push(callback);
    // If already synced, call immediately
    if (this.wsProvider.synced) {
      callback();
    }
  }

  onUpdate(callback: (update: Uint8Array) => void): void {
    this.updateCallbacks.push(callback);
  }

  setLocalAwareness(state: Partial<UserAwareness>): void {
    this.wsProvider.awareness.setLocalStateField('user', state);
  }

  getAwarenessStates(): AwarenessState {
    const states = this.wsProvider.awareness.getStates() as Map<number, { user?: UserAwareness }>;
    const result: AwarenessState = new Map();
    for (const [clientId, state] of states) {
      if (state.user) {
        result.set(clientId, state.user);
      }
    }
    return result;
  }

  get connected(): boolean {
    return this.wsProvider.wsconnected;
  }

  destroy(): void {
    this.destroyed = true;
    this.syncCallbacks = [];
    this.updateCallbacks = [];
    this.wsProvider.disconnect();
    this.wsProvider.destroy();
    this.ydoc.destroy();
  }
}
