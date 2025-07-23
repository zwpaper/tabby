import { vscodeHost } from "@/lib/vscode";
import type { UIMessage } from "@ai-sdk/ui-utils";
import { fromUIMessages } from "@ragdoll/common";
import type { Environment } from "@ragdoll/db";
import type { ChatRequest as RagdollChatRequest } from "@ragdoll/server";
import type { McpTool } from "@ragdoll/vscode-webui-bridge";
import type { RefObject } from "react";

export async function prepareRequestBody(
  uid: RefObject<string | undefined>,
  request: {
    messages: UIMessage[];
  },
  environment: Environment,
  mcpToolSet: Record<string, McpTool>,
  model: string | undefined,
  minionId?: string | null,
  openAIModelOverride?: RagdollChatRequest["openAIModelOverride"],
): Promise<RagdollChatRequest> {
  const last2Messages = request.messages.slice(-2);
  const lastMessage = last2Messages.at(-1);
  await appendCheckpoint(lastMessage as UIMessageWithRevisionId);
  const triggerError =
    lastMessage?.parts[0].type === "text" &&
    lastMessage?.parts[0].text.includes("RAGDOLL_DEBUG_TRIGGER_ERROR");
  return {
    id: uid.current || undefined,
    model: triggerError ? "fake-model" : model,
    messages: fromUIMessages(last2Messages),
    minionId: minionId || undefined,
    environment,
    // @ts-expect-error
    mcpToolSet,
    openAIModelOverride,
  };
}

type UIMessageWithRevisionId = UIMessage & { revisionId: string };

async function appendCheckpoint(message: UIMessageWithRevisionId) {
  const { id, revisionId } = message;
  const ckpt = await vscodeHost.saveCheckpoint(
    `ckpt-msg-${id}-rev-${revisionId}`,
    {
      force: message.role === "user",
    },
  );
  if (!ckpt) return;

  const checkpoint = {
    type: "checkpoint",
    checkpoint: { commit: ckpt },
  } as const;

  // @ts-expect-error
  message.parts.push(checkpoint);
}
