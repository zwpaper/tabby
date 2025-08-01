import { convertToModelMessages, streamText } from "@ai-v5-sdk/ai";
import { createOpenAICompatible } from "@ai-v5-sdk/openai-compatible";
import { ClientToolsV5 } from "@getpochi/tools";
import type { Message } from "../livestore/types";

const openai = createOpenAICompatible({
  baseURL: "https://api.deepinfra.com/v1/openai",
  apiKey: import.meta.env.VITE_DEEPINFRA_API_KEY,
  name: "deepinfra",
});

export const fetchChatApi: typeof fetch = async (input, init) => {
  if (input !== "/api/chat") {
    return fetch(input, init);
  }

  if (typeof init?.body !== "string") {
    throw new Error("Request body is required for custom fetch implementation");
  }

  const { messages } = JSON.parse(init.body) as { messages: Message[] };
  const result = streamText({
    model: openai("moonshotai/Kimi-K2-Instruct"),
    messages: convertToModelMessages(messages),
    tools: ClientToolsV5,
  });
  return result.toUIMessageStreamResponse();
};
