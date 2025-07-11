import { type Signal, signal } from "@preact/signals-core";
import { CredentialStorage } from "@ragdoll/common/node";
import { isDev } from "@ragdoll/vscode-webui-bridge";
import { injectable, singleton } from "tsyringe";
import type * as vscode from "vscode";

@injectable()
@singleton()
export class TokenStorage implements vscode.Disposable {
  token: Signal<string | undefined> = signal(process.env.POCHI_SESSION_TOKEN);
  dispose: () => void = () => {};

  async init() {
    if (process.env.POCHI_SESSION_TOKEN) {
      return;
    }
    const credentialStorage = new CredentialStorage({
      isDev,
    });
    this.token.value = await credentialStorage.read();
    this.dispose = this.token.subscribe(async (token) => {
      await credentialStorage.write(token);
    });
  }
}
