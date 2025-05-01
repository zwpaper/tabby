import * as vscode from "vscode";

import { collectCustomRules, getSystemInfo } from "@/lib/env-utils";
import type { TokenStorage } from "@/lib/token-storage";
import {
  ThreadAbortSignal,
  type ThreadAbortSignalSerialization,
} from "@quilted/threads";
import type { Environment } from "@ragdoll/server";
import type { ToolFunctionType } from "@ragdoll/tools";
import type { PreviewToolFunctionType } from "@ragdoll/tools/src/types";
import type { VSCodeHostApi } from "@ragdoll/vscode-webui-bridge";
import { workspace } from "vscode";
import { listFiles } from "./list-files";
import { executeCommand } from "./tools/execute-command";
import { readFile } from "./tools/read-file";
import { searchFiles } from "./tools/search-files";
import { previewWriteToFile } from "./tools/write-to-file";

export default class VSCodeHostImpl implements VSCodeHostApi {
  constructor(private readonly tokenStorage: TokenStorage) {
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

  private readonly DEFAULT_MAX_FILES: number = 500;
  async readEnvironment(customRuleFiles: string[] = []): Promise<Environment> {
    const files = (await listFiles(undefined, this.DEFAULT_MAX_FILES)).map(
      (res) => res.uri.fsPath,
    );

    const customRules = await collectCustomRules(customRuleFiles);

    const systemInfo = await getSystemInfo();

    const environment = {
      currentTime: new Date().toString(),
      workspace: {
        files,
        isTruncated: files.length >= this.DEFAULT_MAX_FILES,
      },
      info: {
        ...systemInfo,
        customRules,
      },
    };

    return environment;
  }

  async listFilesInWorkspace(param: { query: string; limit?: number }): Promise<
    string[]
  > {
    const { query, limit } = param;
    const results = await listFiles(query, limit);
    return results.map((item) => workspace.asRelativePath(item.uri));
  }

  async executeToolCall(
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

  async previewToolCall(
    toolName: string,
    args: unknown,
    options: {
      toolCallId: string;
      abortSignal: ThreadAbortSignalSerialization;
    },
  ) {
    const tool = ToolPreviewMap[toolName];
    if (!tool) {
      return;
    }

    const abortSignal = new ThreadAbortSignal(options.abortSignal);
    // biome-ignore lint/suspicious/noExplicitAny: external call without type information
    return tool(args as any, {
      abortSignal,
      toolCallId: options.toolCallId,
      messages: [],
    });
  }

  async openFile(filePath: string) {
    const current = vscode.workspace.workspaceFolders?.[0].uri;
    if (!current) {
      throw new Error("No workspace folder found.");
    }
    vscode.window.showTextDocument(vscode.Uri.joinPath(current, filePath));
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
};

const ToolPreviewMap: Record<
  string,
  // biome-ignore lint/suspicious/noExplicitAny: external call without type information
  PreviewToolFunctionType<any>
> = {
  writeToFile: previewWriteToFile,
};
