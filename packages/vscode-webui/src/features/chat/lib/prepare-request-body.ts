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
  modelEndpointId?: string,
): Promise<RagdollChatRequest> {
  const lastMessage = request.messages.at(-1);
  if (!lastMessage) {
    throw new Error("Cannot prepare request body with no messages.");
  }

  const messagesToSend =
    lastMessage.role === "user"
      ? request.messages.slice(-2)
      : request.messages.slice(-1);

  const lastMessageToSend = messagesToSend.at(-1);

  await appendCheckpoint(lastMessageToSend as UIMessageWithRevisionId);
  return {
    id: uid.current || undefined,
    model,
    messages: fromUIMessages(messagesToSend),
    minionId: minionId || undefined,
    environment,
    // @ts-expect-error
    mcpToolSet,
    openAIModelOverride,
    modelEndpointId,
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
