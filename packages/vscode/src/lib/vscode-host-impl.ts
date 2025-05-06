import * as vscode from "vscode";

import { collectCustomRules, getSystemInfo } from "@/lib/env-utils";
import { ignoreWalk } from "@/lib/fs";
import type { TokenStorage } from "@/lib/token-storage";
import {
  ThreadAbortSignal,
  type ThreadAbortSignalSerialization,
} from "@quilted/threads";
import type { Environment } from "@ragdoll/server";
import type { ToolFunctionType } from "@ragdoll/tools";
import type { PreviewToolFunctionType } from "@ragdoll/tools/src/types";
import type { VSCodeHostApi } from "@ragdoll/vscode-webui-bridge";
import { applyDiff, previewApplyDiff } from "./tools/apply-diff";
import { executeCommand } from "./tools/execute-command";
import { globFiles } from "./tools/glob-files";
import { listFiles as listFilesTool } from "./tools/list-files";
import { readFile } from "./tools/read-file";
import { searchFiles } from "./tools/search-files";
import { previewWriteToFile, writeToFile } from "./tools/write-to-file";

export default class VSCodeHostImpl implements VSCodeHostApi {
  private toolCallQueue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly tokenStorage: TokenStorage,
    readonly readResourceURI: VSCodeHostApi["readResourceURI"],
  ) {
    this.getToken = this.getToken.bind(this);
    this.setToken = this.setToken.bind(this);
    this.readEnvironment = this.readEnvironment.bind(this);
    this.executeToolCall = this.executeToolCall.bind(this);
    this.previewToolCall = this.previewToolCall.bind(this);
  }

  async getToken(): Promise<string | undefined> {
    return this.tokenStorage.getToken();
  }

  async setToken(token: string | undefined): Promise<void> {
    return this.tokenStorage.setToken(token);
  }

  async readEnvironment(): Promise<Environment> {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    const MaxFileItems = 500;
    let files = workspaceFolders?.length
      ? (
          await ignoreWalk({ dir: workspaceFolders[0].uri, recursive: true })
        ).map((res) => res.uri.fsPath)
      : [];
    const isTruncated = files.length > MaxFileItems;
    files = files.slice(0, MaxFileItems);

    const customRules = await collectCustomRules();

    const systemInfo = await getSystemInfo();

    const environment = {
      currentTime: new Date().toString(),
      workspace: {
        files,
        isTruncated,
      },
      info: {
        ...systemInfo,
        customRules,
      },
    };

    return environment;
  }

  async listFilesInWorkspace(): Promise<
    {
      filepath: string;
      isDir: boolean;
    }[]
  > {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders?.length || !workspaceFolders[0]) {
      return [];
    }

    const results = await ignoreWalk({
      dir: workspaceFolders[0].uri,
      recursive: true,
    });
    return results.map((item) => ({
      filepath: vscode.workspace.asRelativePath(item.uri),
      isDir: item.isDir,
    }));
  }

  private async queueToolCall<T>(fn: () => Promise<T>) {
    const toolCallPromise = this.toolCallQueue.catch(console.error).then(fn);
    this.toolCallQueue = toolCallPromise;
    return toolCallPromise;
  }

  executeToolCall(
    toolName: string,
    args: unknown,
    options: {
      toolCallId: string;
      abortSignal: ThreadAbortSignalSerialization;
    },
  ) {
    return this.queueToolCall(() =>
      this.executeToolCallImpl(toolName, args, options),
    );
  }

  previewToolCall(
    toolName: string,
    args: unknown,
    options: {
      toolCallId: string;
    },
  ) {
    return this.queueToolCall(() =>
      this.previewToolCallImpl(toolName, args, options),
    );
  }

  private async executeToolCallImpl(
    toolName: string,
    args: unknown,
    options: {
      toolCallId: string;
      abortSignal: ThreadAbortSignalSerialization;
    },
  ) {
    const tool = ToolMap[toolName];
    if (!tool) {
      return {
        error: `Tool ${toolName} is not implemented`,
      };
    }

    const abortSignal = new ThreadAbortSignal(options.abortSignal);

    return safeCall(
      tool(args, {
        abortSignal,
        messages: [],
        toolCallId: options.toolCallId,
      }),
    );
  }

  private async previewToolCallImpl(
    toolName: string,
    args: unknown,
    options: {
      toolCallId: string;
    },
  ) {
    const tool = ToolPreviewMap[toolName];
    if (!tool) {
      return;
    }

    // biome-ignore lint/suspicious/noExplicitAny: external call without type information
    return tool(args as any, {
      abortSignal: undefined,
      toolCallId: options.toolCallId,
      messages: [],
    });
  }

  async openFile(filePath: string, options?: { line?: number }) {
    const line = options?.line;
    const current = vscode.workspace.workspaceFolders?.[0].uri;
    if (!current) {
      throw new Error("No workspace folder found.");
    }
    vscode.window.showTextDocument(vscode.Uri.joinPath(current, filePath), {
      selection: new vscode.Range(line ?? 0, 0, line ?? 0, 0),
    });
  }
}

function safeCall<T>(x: Promise<T>) {
  return x.catch((e) => {
    return {
      error: e.message,
    };
  });
}

const ToolMap: Record<
  string,
  // biome-ignore lint/suspicious/noExplicitAny: external call without type information
  ToolFunctionType<any>
> = {
  readFile,
  executeCommand,
  searchFiles,
  listFiles: listFilesTool,
  globFiles,
  writeToFile,
  applyDiff,
};

const ToolPreviewMap: Record<
  string,
  // biome-ignore lint/suspicious/noExplicitAny: external call without type information
  PreviewToolFunctionType<any>
> = {
  writeToFile: previewWriteToFile,
  applyDiff: previewApplyDiff,
};
