import type { ToolUIPart } from "@ai-v5-sdk/ai";
import type { UITools } from "@getpochi/livekit";
import type { ToolCallCheckpoint } from "../message/message-list";

export interface ToolProps<T extends string> {
  tool: Extract<ToolUIPart<UITools>, { type: `tool-${T}` }>;
  isExecuting: boolean;
  isLoading: boolean;
  changes?: ToolCallCheckpoint;
}
