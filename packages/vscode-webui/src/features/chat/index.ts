// Export the main context and provider
export {
  ChatContextProvider,
  useAutoApproveGuard,
  useToolCallLifeCycle,
} from "./lib/chat-state";

export { ChatEventProvider, useSendMessage } from "./lib/chat-events";

// Export new tool call state management hooks
export type { ToolCallLifeCycle } from "./lib/tool-call-life-cycle";
