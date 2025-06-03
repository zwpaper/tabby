// Export the main context and provider
export {
  ChatContextProvider,
  useToolCallState,
  useToolEvents,
  useAutoApproveGuard,
  useStreamToolCallResult,
} from "./context";

// Export new tool call state management hooks
export type { ToolCallState } from "./hooks/use-tool-call-states";
