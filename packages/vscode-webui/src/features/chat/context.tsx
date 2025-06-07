import type React from "react";
import { type ReactNode, createContext, useContext, useRef } from "react";
import {
  type ToolCallLifeCycle,
  useToolCallLifeCycles,
} from "./internal/use-tool-call-life-cycles";
import { ToolEvents } from "./lib/tool-events";

interface ChatState {
  autoApproveGuard: React.MutableRefObject<boolean>;
  toolEvents: React.RefObject<ToolEvents>;
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
  const toolEvents = useRef(new ToolEvents());

  const { hasExecutingToolCall, getToolCallLifeCycle, completeToolCalls } =
    useToolCallLifeCycles();

  const value: ChatState = {
    autoApproveGuard,
    toolEvents,
    getToolCallLifeCycle,
    hasExecutingToolCall,
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

export function useToolEvents() {
  const toolEvents = useChatState().toolEvents.current;
  if (!toolEvents) {
    throw new Error("ToolEvents is not initialized");
  }

  return toolEvents;
}

export function useAutoApproveGuard() {
  return useChatState().autoApproveGuard;
}

export function useToolCallLifeCycle() {
  const { getToolCallLifeCycle, hasExecutingToolCall, completeToolCalls } =
    useChatState();
  return { getToolCallLifeCycle, hasExecutingToolCall, completeToolCalls };
}
