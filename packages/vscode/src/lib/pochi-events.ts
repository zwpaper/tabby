import { type PochiEventSource, createPochiEventSource } from "@ragdoll/server";
import { getServerBaseUrl } from "@ragdoll/vscode-webui-bridge";
import { injectable, singleton } from "tsyringe";
import type * as vscode from "vscode";
// biome-ignore lint/style/useImportType: needed for dependency injection
import { TokenStorage } from "./token-storage";

@injectable()
@singleton()
export class PochiEvents implements PochiEventSource, vscode.Disposable {
  private eventSource: PochiEventSource;
  private readonly listenersMap: Map<string, Set<(data: unknown) => void>> =
    new Map();
  private readonly disposables: vscode.Disposable[] = [];

  constructor(private readonly tokenStorage: TokenStorage) {
    this.eventSource = this.createEventSource();

    this.disposables.push({
      dispose: this.tokenStorage.token.subscribe(() => {
        // Recreate the event source when the token changes
        this.eventSource.dispose();
        this.eventSource = this.createEventSource();
        // Re-subscribe all listeners to the new event source
        for (const [type, listeners] of this.listenersMap.entries()) {
          for (const listener of listeners) {
            this.eventSource.subscribe(type, listener);
          }
        }
      }),
    });
  }

  private createEventSource() {
    return createPochiEventSource(
      getServerBaseUrl(),
      this.tokenStorage.token.value,
    );
  }

  subscribe<T extends { type: string }>(
    type: string,
    listener: (data: T) => void,
  ) {
    const eventListener = listener as (data: unknown) => void;
    const listeners = this.listenersMap.get(type);
    if (listeners !== undefined) {
      listeners.add(eventListener);
    } else {
      this.listenersMap.set(type, new Set([eventListener]));
    }
    const unsubscribe = this.eventSource.subscribe(type, eventListener);
    return () => {
      const listeners = this.listenersMap.get(type);
      if (listeners !== undefined) {
        listeners.delete(eventListener);
      }
      unsubscribe();
    };
  }

  dispose() {
    this.eventSource.dispose();
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.listenersMap.clear();
  }
}
