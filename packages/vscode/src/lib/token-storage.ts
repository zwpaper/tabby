import { type Signal, signal } from "@preact/signals-core";
import { inject, injectable, singleton } from "tsyringe";
import type * as vscode from "vscode";

@injectable()
@singleton()
export class TokenStorage implements vscode.Disposable {
  private static BearerTokenKey = "bearer_token";
  token: Signal<string | undefined>;
  dispose: () => void;

  constructor(
    @inject("vscode.ExtensionContext")
    private readonly context: vscode.ExtensionContext,
  ) {
    this.token = signal(
      this.context.globalState.get<string>(TokenStorage.BearerTokenKey),
    );
    this.dispose = this.token.subscribe((token) =>
      this.context.globalState.update(TokenStorage.BearerTokenKey, token),
    );
  }
}
