import type { Tool } from "@ai-v5-sdk/ai";
import type { LanguageModelV2Middleware } from "@ai-v5-sdk/provider";
import type { Environment } from "@getpochi/base";
import type { Message } from "../../types";

export type LLMRequest = {
  id?: string;
  system: string;
  abortSignal?: AbortSignal;
  messages: Message[];
  tools?: Record<string, Tool>;
  middlewares?: LanguageModelV2Middleware[];
  environment?: Environment;
};

export type OnFinishCallback = (data: {
  messages: Message[];
}) => PromiseLike<void>;
