import * as vscode from "vscode";

// biome-ignore lint/style/useImportType: needed for dependency injection
import { GitStatus } from "@/integrations/git/git-status";
import { collectCustomRules, getSystemInfo } from "@/lib/env";
import { ignoreWalk, isBinaryFile } from "@/lib/fs";
import { getLogger } from "@/lib/logger";
// biome-ignore lint/style/useImportType: needed for dependency injection
import { TokenStorage } from "@/lib/token-storage";
import { applyDiff, previewApplyDiff } from "@/tools/apply-diff";
import { executeCommand } from "@/tools/execute-command";
import { globFiles } from "@/tools/glob-files";
import { listFiles as listFilesTool } from "@/tools/list-files";
import { readFile } from "@/tools/read-file";
import { searchFiles } from "@/tools/search-files";
import { todoWrite } from "@/tools/todo-write";
import { previewWriteToFile, writeToFile } from "@/tools/write-to-file";
import {
  ThreadAbortSignal,
  type ThreadAbortSignalSerialization,
} from "@quilted/threads";
import {
  ThreadSignal,
  type ThreadSignalSerialization,
} from "@quilted/threads/signals";
import type { Environment } from "@ragdoll/server";
import {
  ServerToolApproved,
  ServerTools,
  type ToolFunctionType,
} from "@ragdoll/tools";
import type { PreviewToolFunctionType } from "@ragdoll/tools/src/types";
import type {
  ResourceURI,
  SessionState,
  VSCodeHostApi,
} from "@ragdoll/vscode-webui-bridge";
import * as runExclusive from "run-exclusive";
import { injectable, singleton } from "tsyringe";
// biome-ignore lint/style/useImportType: needed for dependency injection
import { TabState } from "../editor/tab-state";

const logger = getLogger("VSCodeHostImpl");

@injectable()
@singleton()
export class VSCodeHostImpl implements VSCodeHostApi {
  private toolCallGroup = runExclusive.createGroupRef();
  private sessionState: SessionState = {};

  constructor(
    private readonly tokenStorage: TokenStorage,
    private readonly tabState: TabState,
    private readonly gitStatus: GitStatus,
  ) {}

  readResourceURI = (): Promise<ResourceURI> => {
    throw new Error("Method not implemented.");
  };

  readToken = async (): Promise<
    ThreadSignalSerialization<string | undefined>
  > => {
    return ThreadSignal.serialize(this.tokenStorage.token, {
      writable: true,
    });
  };

  getSessionState = async <K extends keyof SessionState>(
    keys?: K[] | undefined,
  ): Promise<Pick<SessionState, K>> => {
    if (!keys || keys.length === 0) {
      return { ...this.sessionState };
    }

    return keys.reduce<Pick<SessionState, K>>(
      (filtered, key) => {
        if (Object.prototype.hasOwnProperty.call(this.sessionState, key)) {
          filtered[key] = this.sessionState[key];
        }
        return filtered;
      },
      {} as Pick<SessionState, K>,
    );
  };

  setSessionState = async (state: Partial<SessionState>): Promise<void> => {
    Object.assign(this.sessionState, state);
  };

  readEnvironment = async (): Promise<Environment> => {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    const MaxFileItems = 500;
    let files = workspaceFolders?.length
      ? (
          await ignoreWalk({ dir: workspaceFolders[0].uri, recursive: true })
        ).map((res) => vscode.workspace.asRelativePath(res.uri))
      : [];
    const isTruncated = files.length > MaxFileItems;
    files = files.slice(0, MaxFileItems);

    const customRules = await collectCustomRules();

    const systemInfo = await getSystemInfo();

    const gitStatus = await this.gitStatus.readGitStatus();

    const environment = {
      currentTime: new Date().toString(),
      workspace: {
        files,
        isTruncated,
      },
      info: {
        ...systemInfo,
        customRules,
        gitStatus,
      },
    };

    return environment;
  };

  readActiveTabs = async (): Promise<
    ThreadSignalSerialization<Array<{ filepath: string; isDir: boolean }>>
  > => {
    return ThreadSignal.serialize(this.tabState.activeTabs);
  };

  readCurrentWorkspace = async (): Promise<string | undefined> => {
    return vscode.workspace.workspaceFolders?.[0].uri.fsPath;
  };

  listFilesInWorkspace = async (): Promise<
    {
      filepath: string;
      isDir: boolean;
    }[]
  > => {
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
  };

  executeToolCall = runExclusive.build(
    this.toolCallGroup,
    async (
      toolName: string,
      args: unknown,
      options: {
        toolCallId: string;
        abortSignal: ThreadAbortSignalSerialization;
      },
    ) => {
      if (toolName in ServerTools) {
        return ServerToolApproved;
      }

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
    },
  );

  previewToolCall = runExclusive.build(
    this.toolCallGroup,
    async (
      toolName: string,
      args: unknown,
      options: {
        toolCallId: string;
        state: "partial-call" | "call" | "result";
      },
    ) => {
      const tool = ToolPreviewMap[toolName];
      if (!tool) {
        return;
      }

      // biome-ignore lint/suspicious/noExplicitAny: external call without type information
      return await safeCall<undefined>(tool(args as any, options));
    },
  );

  openFile = async (
    filePath: string,
    options?: { start?: number; end?: number },
  ) => {
    const current = vscode.workspace.workspaceFolders?.[0].uri;
    if (!current) {
      throw new Error("No workspace folder found.");
    }
    const fileUri = vscode.Uri.joinPath(current, filePath);
    try {
      const stat = await vscode.workspace.fs.stat(fileUri);
      if (stat.type === vscode.FileType.Directory) {
        // reveal and expand it
        await vscode.commands.executeCommand("revealInExplorer", fileUri);
        await vscode.commands.executeCommand("list.expand");
        return;
      }
    } catch (error) {
      logger.error(`Failed to reveal folder in explorer: ${error}`);
    }

    const isBinary = await isBinaryFile(fileUri);
    if (isBinary) {
      await vscode.commands.executeCommand("vscode.open", fileUri);
    } else {
      const start = options?.start ?? 1;
      const end = options?.end ?? start;
      vscode.window.showTextDocument(fileUri, {
        selection: new vscode.Range(start - 1, 0, end - 1, 0),
      });
    }
  };
}

function safeCall<T>(x: Promise<T>) {
  return x.catch((e) => {
    return {
      error: e.message as string,
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
  todoWrite,
};

const ToolPreviewMap: Record<
  string,
  // biome-ignore lint/suspicious/noExplicitAny: external call without type information
  PreviewToolFunctionType<any>
> = {
  writeToFile: previewWriteToFile,
  applyDiff: previewApplyDiff,
};
