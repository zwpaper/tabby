import { signal } from "@preact/signals-core";
import { inject, injectable, singleton } from "tsyringe";
import * as vscode from "vscode";
import type { AuthClient } from "./auth-client";

@injectable()
@singleton()
export class AuthEvents implements vscode.Disposable {
  // FIXME(zhiming): remove events and move all usages to signal
  public readonly loginEvent = new vscode.EventEmitter<void>();
  public readonly logoutEvent = new vscode.EventEmitter<void>();

  // true: logged in
  // false: logged out
  // undefined: initializing
  public readonly isLoggedIn = signal<boolean | undefined>(undefined);

  private disposables: vscode.Disposable[] = [];

  constructor(@inject("AuthClient") private readonly authClient: AuthClient) {
    // Initialize the login state
    this.authClient.getSession().then(({ data }) => {
      if (data?.session) {
        this.isLoggedIn.value = true;
      } else {
        this.isLoggedIn.value = false;
      }
    });

    this.disposables.push(
      this.loginEvent.event(() => {
        this.isLoggedIn.value = true;
      }),
    );

    this.disposables.push(
      this.logoutEvent.event(() => {
        this.isLoggedIn.value = false;
      }),
    );
  }

  public dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];

    this.loginEvent.dispose();
    this.logoutEvent.dispose();
  }
}
