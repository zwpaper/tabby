import { type PochiEventSource, createPochiEventSource } from "@ragdoll/server";
import { getServerBaseUrl } from "@ragdoll/vscode-webui-bridge";
import { injectable, singleton } from "tsyringe";
import type * as vscode from "vscode";
import type { TokenStorage } from "./token-storage";

@injectable()
@singleton()
export class PochiEvents implements PochiEventSource, vscode.Disposable {
  private pochiEventSource: PochiEventSource;

  constructor(tokenStorage: TokenStorage) {
    this.pochiEventSource = createPochiEventSource(
      getServerBaseUrl(),
      tokenStorage.token.value,
    );
  }

  subscribe<T extends { type: string }>(
    type: string,
    listener: (data: T) => void,
  ) {
    return this.pochiEventSource.subscribe(type, listener);
  }

  dispose() {
    this.pochiEventSource.dispose();
  }
}
