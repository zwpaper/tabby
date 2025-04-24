import type { AuthClient } from "@/lib/auth-client";
import * as vscode from "vscode";

class RagdollUriHandler implements vscode.UriHandler {
  readonly loginEvent = new vscode.EventEmitter<void>();

  constructor(private authClient: AuthClient) {}

  handleUri(uri: vscode.Uri): vscode.ProviderResult<void> {
    const searchParams = new URLSearchParams(uri.query);
    const token = searchParams.get("token");
    if (token) {
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          cancellable: false,
        },
        async (progress) => {
          progress.report({ message: "Login in progress, please wait..." });
          await this.loginWithDeviceLink(token);
        },
      );
    }
  }

  async loginWithDeviceLink(token: string) {
    const { data, error } = await this.authClient.deviceLink.verify({
      query: { token },
    });

    if (error || "error" in data) {
      vscode.window.showErrorMessage("Failed to login, please try again.");
      return;
    }

    vscode.window.showInformationMessage("Successfully logged in!");
    this.loginEvent.fire();
  }
}

export default RagdollUriHandler;
