import type * as vscode from "vscode";

export class TokenStorage {
  constructor(private readonly context: vscode.ExtensionContext) {}
  static BearerTokenKey = "bearer_token";

  async setToken(token: string | undefined) {
    await this.context.globalState.update(TokenStorage.BearerTokenKey, token);
  }

  getToken(): string | undefined {
    return this.context.globalState.get<string>(TokenStorage.BearerTokenKey);
  }
}
