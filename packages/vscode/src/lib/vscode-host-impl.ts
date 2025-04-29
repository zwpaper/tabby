import { collectCustomRules, getSystemInfo } from "@/lib/env-utils";
import { listFiles } from "@/lib/file-utils";
import type { TokenStorage } from "@/lib/token-storage";
import {
  ThreadAbortSignal,
  type ThreadAbortSignalSerialization,
} from "@quilted/threads";
import type { Environment } from "@ragdoll/server";
import type { ToolFunctionType } from "@ragdoll/tools";
import type { VSCodeHostApi } from "@ragdoll/vscode-webui-bridge";
import { readFile } from "./tools/read-file";
import type { PreviewToolFunctionType } from "./tools/types";
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

  async readEnvironment(customRuleFiles: string[] = []): Promise<Environment> {
    const { files, isTruncated } = await listFiles(500);

    const customRules = await collectCustomRules(customRuleFiles);

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

    return tool(args, {
      abortSignal,
      messages: [],
      toolCallId: options.toolCallId,
    });
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
    return tool(args, {
      abortSignal,
      toolCallId: options.toolCallId,
      messages: [],
    });
  }
}

const ToolMap: Record<
  string,
  // biome-ignore lint/suspicious/noExplicitAny: external call without type information
  ToolFunctionType<any>
> = {
  readFile,
};

const ToolPreviewMap: Record<
  string,
  // biome-ignore lint/suspicious/noExplicitAny: external call without type information
  PreviewToolFunctionType<any>
> = {
  writeToFile: previewWriteToFile,
};
