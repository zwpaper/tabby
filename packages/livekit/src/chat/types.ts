import type { McpTool } from "@getpochi/tools";
import type { Message } from "../types";

export type LLMRequest = {
  id: string;
  system: string;
  abortSignal?: AbortSignal;
  messages: Message[];
  mcpToolSet?: Record<string, McpTool>;
};
