import * as vscode from "vscode";
import { authClient } from "../lib/auth-client";

class RagdollUriHandler implements vscode.UriHandler {
  constructor(private context: vscode.ExtensionContext) {}

  handleUri(uri: vscode.Uri): vscode.ProviderResult<void> {
    const searchParams = new URLSearchParams(uri.query);
    const token = searchParams.get("token");
    if (token) {
      this.loginWithDeviceLink(token);
    }
  }

  async loginWithDeviceLink(token: string) {
    const { data, error } = await authClient.deviceLink.verify({
      query: { token },
    });

    if (error || "error" in data) {
      vscode.window.showErrorMessage("Failed to login, please try again.");
      return;
    }

    this.context.globalState.update("session", data);
  }
}

export default RagdollUriHandler;
