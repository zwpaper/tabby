import { DefaultChatTransport } from "@ai-v5-sdk/ai";

import type { Message, RequestData } from "../types";
import type { LLMRequest } from "./types";

const defaultTransport = new DefaultChatTransport<Message>({});

export async function requestPochi(
  llm: Extract<RequestData["llm"], { type: "pochi" }>,
  payload: LLMRequest,
) {
  const body = JSON.stringify({
    id: payload.id,
    system: payload.system,
    messages: payload.messages,
    model: llm.modelId,
    mcpToolSet: payload.mcpToolSet,
  });
  const response = await fetch(`${llm.server}/api/chatNext/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${llm.token}`,
    },
    signal: payload.abortSignal,
    body,
  });

  if (!response.ok) {
    throw new Error(
      (await response.text()) ?? "Failed to fetch the chat response.",
    );
  }

  if (!response.body) {
    throw new Error("The response body is empty.");
  }

  // @ts-expect-error reuse default transport.
  return defaultTransport.processResponseStream(response.body);
}
