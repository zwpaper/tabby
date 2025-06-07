// Export the main context and provider
export {
  ChatContextProvider,
  useToolEvents,
  useAutoApproveGuard,
  useToolCallLifeCycle,
} from "./context";

// Export new tool call state management hooks
export type { ToolCallLifeCycle } from "./internal/tool-call-life-cycle";
