import type { AuthClient } from "@/lib/auth-client";
import * as vscode from "vscode";

class RagdollUriHandler implements vscode.UriHandler {
  constructor(private authClient: AuthClient) {}

  handleUri(uri: vscode.Uri): vscode.ProviderResult<void> {
    const searchParams = new URLSearchParams(uri.query);
    const token = searchParams.get("token");
    if (token) {
      this.loginWithDeviceLink(token);
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

    this.authClient.updateSession(data);
    vscode.window.showInformationMessage("Successfully logged in!");
  }
}

export default RagdollUriHandler;
