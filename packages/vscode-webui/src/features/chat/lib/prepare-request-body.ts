import { vscodeHost } from "@/lib/vscode";
import type { UIMessage } from "@ai-sdk/ui-utils";
import { fromUIMessage } from "@ragdoll/common";
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
  enableCheckpoint: boolean,
  minionId?: string | null,
): Promise<RagdollChatRequest> {
  const message = request.messages[request.messages.length - 1];
  enableCheckpoint &&
    (await appendCheckpoint(message as UIMessageWithRevisionId));
  const triggerError =
    message.parts[0].type === "text" &&
    message.parts[0].text.includes("RAGDOLL_DEBUG_TRIGGER_ERROR");
  return {
    id: uid.current || undefined,
    model: triggerError ? "fake-model" : model,
    message: fromUIMessage(message),
    minionId: minionId || undefined,
    environment,
    // @ts-expect-error
    mcpToolSet,
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
