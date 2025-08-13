import type { Tool } from "@ai-v5-sdk/ai";
import type { LanguageModelV2Middleware } from "@ai-v5-sdk/provider";
import type { Message } from "../../types";

export type LLMRequest = {
  id?: string;
  system: string;
  abortSignal?: AbortSignal;
  messages: Message[];
  tools?: Record<string, Tool>;
  middlewares?: LanguageModelV2Middleware[];
};
