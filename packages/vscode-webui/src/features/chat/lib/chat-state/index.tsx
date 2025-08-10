import { useContext } from "react";
import { ChatContext, type ChatState } from "./types";

function useChatState(): ChatState {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChatState must be used within a ChatContextProvider");
  }
  return context;
}

export function useAutoApproveGuard() {
  return useChatState().autoApproveGuard;
}

export function useToolCallLifeCycle() {
  const { getToolCallLifeCycle, executingToolCalls, completeToolCalls } =
    useChatState();
  return {
    getToolCallLifeCycle,
    executingToolCalls,
    completeToolCalls,
  };
}

export { ChatContextProvider } from "./chat";
