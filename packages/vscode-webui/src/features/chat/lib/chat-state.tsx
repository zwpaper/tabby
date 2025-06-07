import type React from "react";
import { type ReactNode, createContext, useContext, useRef } from "react";
import { ChatEventProvider } from "./chat-events";
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
  hasExecutingToolCall: boolean;
  completeToolCalls: ToolCallLifeCycle[];
}

const ChatContext = createContext<ChatState | undefined>(undefined);

interface ChatContextProviderProps {
  children: ReactNode;
}

export function ChatContextProvider({ children }: ChatContextProviderProps) {
  const autoApproveGuard = useRef(false);

  const { hasExecutingToolCall, getToolCallLifeCycle, completeToolCalls } =
    useToolCallLifeCycles();

  const value: ChatState = {
    autoApproveGuard,
    getToolCallLifeCycle,
    hasExecutingToolCall,
    completeToolCalls,
  };

  return (
    <ChatContext.Provider value={value}>
      <ChatEventProvider append={() => {}}>{children}</ChatEventProvider>
    </ChatContext.Provider>
  );
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
  const { getToolCallLifeCycle, hasExecutingToolCall, completeToolCalls } =
    useChatState();
  return {
    getToolCallLifeCycle,
    hasExecutingToolCall,
    completeToolCalls,
  };
}
