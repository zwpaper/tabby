// Modified from: https://github.com/TabbyML/tabby/blob/493cef3b3229548175de430dbc7f7e4a092ca507/clients/tabby-agent/src/contextProviders/workspace.ts

import { injectable, singleton } from "tsyringe";
import * as vscode from "vscode";

export interface WorkspaceContext {
  uri?: vscode.Uri;
}

@injectable()
@singleton()
export class WorkspaceContextProvider {
  async getWorkspaceContext(
    uri: vscode.Uri,
  ): Promise<WorkspaceContext | undefined> {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (workspaceFolder) {
      return { uri: workspaceFolder.uri };
    }
    return undefined;
  }
}
