import type { UIMessage } from "@ai-sdk/ui-utils";
import { fromUIMessage } from "@ragdoll/common";
import type { ChatRequest as RagdollChatRequest } from "@ragdoll/server";
import type { RefObject } from "react";

export function prepareRequestBody(
  uid: RefObject<string | undefined>,
  sessionId: string,
  request: {
    messages: UIMessage[];
  },
  model: string | undefined,
  minionId?: string,
): Omit<RagdollChatRequest, "environment" | "mcpToolSet"> {
  const message = request.messages[request.messages.length - 1];
  const triggerError =
    message.parts[0].type === "text" &&
    message.parts[0].text.includes("RAGDOLL_DEBUG_TRIGGER_ERROR");
  return {
    id: uid.current || undefined,
    model: triggerError ? "fake-model" : model,
    message: fromUIMessage(message),
    sessionId,
    minionId,
  };
}
