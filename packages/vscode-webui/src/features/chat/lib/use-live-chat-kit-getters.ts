import { useSelectedModels } from "@/features/settings";
import { useToken } from "@/lib/auth-client";
import { useLatest } from "@/lib/hooks/use-latest";
import { useMcp } from "@/lib/hooks/use-mcp";
import { usePochiModelSettings } from "@/lib/hooks/use-pochi-model-settings";
import { vscodeHost } from "@/lib/vscode";
import type { Environment } from "@getpochi/base";
import type { Todo } from "@getpochi/tools";
import type { LLMRequestData, Message } from "@ragdoll/livekit";
import { getServerBaseUrl } from "@ragdoll/vscode-webui-bridge";
import type { UserEditsDiff } from "@ragdoll/vscode-webui-bridge";
import { useCallback } from "react";

export function useLiveChatKitGetters({
  todos,
}: {
  todos: React.RefObject<Todo[] | undefined>;
}) {
  const { toolset } = useMcp();
  const mcpToolSet = useLatest(toolset);

  const llm = useLLM();

  const getEnvironment = useCallback(
    async ({ messages }: { messages: readonly Message[] }) => {
      const environment = await vscodeHost.readEnvironment();

      let userEdits: UserEditsDiff[] | undefined;
      const lastCheckpointHash = findLastCheckpointFromMessages(messages);
      if (lastCheckpointHash) {
        userEdits =
          (await vscodeHost.diffWithCheckpoint(lastCheckpointHash)) ??
          undefined;
      }

      return {
        todos: todos.current,
        ...environment,
        userEdits,
      } satisfies Environment;
    },
    [todos],
  );

  return {
    // biome-ignore lint/correctness/useExhaustiveDependencies(llm.current): llm is ref.
    getLLM: useCallback(() => llm.current, []),

    getEnvironment,

    // biome-ignore lint/correctness/useExhaustiveDependencies(mcpToolSet.current): mcpToolSet is ref.
    getMcpToolSet: useCallback(() => mcpToolSet.current, []),
  };
}

function findLastCheckpointFromMessages(
  messages: readonly Message[],
): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    for (const part of message.parts) {
      if (part.type === "data-checkpoint" && part.data?.commit) {
        return part.data.commit;
      }
    }
  }
  return undefined;
}

function useLLM(): React.RefObject<LLMRequestData> {
  const { selectedModel } = useSelectedModels();

  const pochiModelSettings = usePochiModelSettings();

  const token = useToken() || "";

  const llmFromSelectedModel =
    selectedModel?.type === "byok"
      ? {
          type: "openai" as const,
          modelId: selectedModel.modelId,
          baseURL: selectedModel.provider.baseURL,
          apiKey: selectedModel.provider.apiKey,
          maxOutputTokens: selectedModel.maxTokens,
          contextWindow: selectedModel.contextWindow,
        }
      : selectedModel?.type === "hosted"
        ? {
            type: "pochi" as const,
            modelId: selectedModel.modelId,
            modelEndpointId: pochiModelSettings?.modelEndpointId,
            server: getServerBaseUrl(),
            token,
          }
        : (undefined as never);

  return useLatest(llmFromSelectedModel);
}
