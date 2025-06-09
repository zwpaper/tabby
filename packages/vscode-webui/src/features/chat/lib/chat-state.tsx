import type React from "react";
import { type ReactNode, createContext, useContext, useRef } from "react";
import {
  type ToolCallLifeCycle,
  useToolCallLifeCycles,
} from "./use-tool-call-life-cycles";

interface ChatState {
  autoApproveGuard: React.MutableRefObject<boolean>;
  getToolCallLifeCycle: (
    toolName: string,
    toolCallId: string,
  ) => ToolCallLifeCycle;
  executingToolCalls: ToolCallLifeCycle[];
  completeToolCalls: ToolCallLifeCycle[];
}

const ChatContext = createContext<ChatState | undefined>(undefined);

interface ChatContextProviderProps {
  children: ReactNode;
}

export function ChatContextProvider({ children }: ChatContextProviderProps) {
  const autoApproveGuard = useRef(false);

  const { executingToolCalls, getToolCallLifeCycle, completeToolCalls } =
    useToolCallLifeCycles();

  const value: ChatState = {
    autoApproveGuard,
    getToolCallLifeCycle,
    executingToolCalls,
    completeToolCalls,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

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
