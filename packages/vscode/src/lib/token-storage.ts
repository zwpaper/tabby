import { inject, injectable, singleton } from "tsyringe";
import type * as vscode from "vscode";

@injectable()
@singleton()
export class TokenStorage {
  constructor(
    @inject("vscode.ExtensionContext")
    private readonly context: vscode.ExtensionContext,
  ) {}
  static BearerTokenKey = "bearer_token";

  async setToken(token: string | undefined) {
    await this.context.globalState.update(TokenStorage.BearerTokenKey, token);
  }

  getToken(): string | undefined {
    return this.context.globalState.get<string>(TokenStorage.BearerTokenKey);
  }
}
