import { collectCustomRules, getSystemInfo } from "@/lib/env-utils";
import { listFiles } from "@/lib/file-utils";
import type { TokenStorage } from "@/lib/token-storage";
import {
  ThreadAbortSignal,
  type ThreadAbortSignalSerialization,
} from "@quilted/threads";
import type { Environment } from "@ragdoll/server";
import type { VSCodeHostApi } from "@ragdoll/vscode-webui-bridge";

export default class VSCodeHostImpl implements VSCodeHostApi {
  constructor(private readonly tokenStorage: TokenStorage) {}

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
      abortSignal?: ThreadAbortSignalSerialization;
    },
  ) {
    console.log("executeToolCall", toolName, args, options);
    const abortSignal = options.abortSignal
      ? new ThreadAbortSignal(options.abortSignal)
      : undefined;
    abortSignal;
    return {
      result: `${toolName} is not implemented yet`,
    };
  }
}
