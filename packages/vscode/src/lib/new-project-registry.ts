import { inject, injectable, singleton } from "tsyringe";
import * as vscode from "vscode";

interface NewProjectRequestEntry {
  requestId: string;
  uri: string;
}

@injectable()
@singleton()
export class NewProjectRegistry {
  private static readonly GlobalStateKey = "new_project_registry";
  private static readonly MaxEntries = 1000;

  constructor(
    @inject("vscode.ExtensionContext")
    private readonly context: vscode.ExtensionContext,
  ) {}

  get(requestId: string): vscode.Uri | undefined {
    const registry = this.context.globalState.get<NewProjectRequestEntry[]>(
      NewProjectRegistry.GlobalStateKey,
      [],
    );
    const uriString = registry.find(
      (entry) => entry.requestId === requestId,
    )?.uri;
    if (!uriString) {
      return undefined;
    }
    try {
      return vscode.Uri.parse(uriString);
    } catch (e) {
      return undefined;
    }
  }

  async set(requestId: string, uri: vscode.Uri) {
    const registry = this.context.globalState.get<NewProjectRequestEntry[]>(
      NewProjectRegistry.GlobalStateKey,
      [],
    );
    registry.push({ requestId, uri: uri.toString() });
    if (registry.length > NewProjectRegistry.MaxEntries) {
      registry.shift();
    }
    await this.context.globalState.update(
      NewProjectRegistry.GlobalStateKey,
      registry,
    );
  }
}
