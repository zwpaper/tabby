import type * as vscode from "vscode";

export interface GitRepository {
  /**
   * The root URI of the git repository.
   */
  root: vscode.Uri;
  /**
   * The url of the default remote.
   */
  remoteUrl?: string;
  /**
   * List of remotes in the git repository.
   */
  remotes?: {
    name: string;
    url: string;
  }[];
}

export interface GitContext {
  /**
   * The git repository.
   */
  repository: GitRepository;
}
