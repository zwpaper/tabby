import type { ToolInvocationUIPart } from "@ragdoll/tools";
import type { Tool } from "ai";
import type { ToolCallCheckpoint } from "../message/message-list";

// biome-ignore lint/suspicious/noExplicitAny: template matching.
export interface ToolProps<T extends Tool<any, any> = Tool<any, any>> {
  tool: ToolInvocationUIPart<T>["toolInvocation"];
  isExecuting: boolean;
  isLoading: boolean;
  changes?: ToolCallCheckpoint;
}
