import type { UIMessage } from "@ai-sdk/ui-utils";
import { fromUIMessage } from "@ragdoll/common";
import type { ChatRequest as RagdollChatRequest } from "@ragdoll/server";
import type { MutableRefObject } from "react";

import { DefaultModelId } from "@/lib/constants";

export function prepareRequestBody(
  taskId: MutableRefObject<number | undefined>,
  request: {
    messages: UIMessage[];
  },
  model: string | undefined,
): Omit<RagdollChatRequest, "environment" | "mcpToolSet"> {
  const message = request.messages[request.messages.length - 1];
  const triggerError =
    message.parts[0].type === "text" &&
    message.parts[0].text.includes("RAGDOLL_DEBUG_TRIGGER_ERROR");
  return {
    id: taskId.current?.toString(),
    model: triggerError ? "fake-model" : (model ?? DefaultModelId),
    message: fromUIMessage(message),
  };
}
