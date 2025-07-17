// Modified from: https://github.com/TabbyML/tabby/blob/493cef3b3229548175de430dbc7f7e4a092ca507/clients/tabby-agent/src/contextProviders/git

import { injectable, singleton } from "tsyringe";
import type * as vscode from "vscode";
// biome-ignore lint/style/useImportType: needed for dependency injection
import { GitCommandRunner } from "./command-runner";
import type { GitContext } from "./types";
export type { GitContext };

@injectable()
@singleton()
export class GitContextProvider {
  constructor(private gitCommandRunner: GitCommandRunner) {}

  async getContext(
    uri: vscode.Uri,
    token?: vscode.CancellationToken | undefined,
  ): Promise<GitContext | undefined> {
    const repository = await this.gitCommandRunner.getRepository(uri, token);
    if (repository) {
      return { repository };
    }
    return undefined;
  }
}
