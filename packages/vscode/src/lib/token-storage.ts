import { type Signal, signal } from "@preact/signals-core";
import { CredentialStorage } from "@ragdoll/common/node";
import { injectable, singleton } from "tsyringe";
import type * as vscode from "vscode";

@injectable()
@singleton()
export class TokenStorage implements vscode.Disposable {
  dispose: () => void = () => {};

  token: Promise<Signal<string | undefined>>;

  constructor() {
    this.token = new Promise<Signal<string | undefined>>((resolve) => {
      if (process.env.POCHI_SESSION_TOKEN) {
        resolve(signal(process.env.POCHI_SESSION_TOKEN));
        return;
      }

      const credentialStorage = new CredentialStorage();
      credentialStorage.read().then((token) => {
        const tokenSignal = signal<string | undefined>(token);
        this.dispose = tokenSignal.subscribe(async (token) => {
          await credentialStorage.write(token);
        });
        resolve(tokenSignal);
      });
    });
  }
}
