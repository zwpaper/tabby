import * as vscode from "vscode";

class RagdollUriHandler implements vscode.UriHandler {
  // This function will get run when something redirects to VS Code
  // with your extension id as the authority.
  handleUri(uri: vscode.Uri): vscode.ProviderResult<void> {
    let message = "Handled a Uri!";
    if (uri.query) {
      message += ` It came with this query: ${uri.query}`;
    }
    vscode.window.showInformationMessage(message);
  }
}

export default new RagdollUriHandler();
