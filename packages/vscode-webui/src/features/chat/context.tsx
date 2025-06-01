import type React from "react";
import { type ReactNode, createContext, useContext, useRef } from "react";
import { useExecutingToolCalls } from "./hooks/use-executing-tool-calls";
import {
  type ToolCallStreamResult,
  useToolStreamResults,
} from "./hooks/use-tool-stream-results";
import { ToolEvents } from "./lib/tool-events";

interface ChatState {
  autoApproveGuard: React.MutableRefObject<boolean>;
  toolEvents: ToolEvents;
  toolStreamResults: {
    add: (result: ToolCallStreamResult) => void;
    remove: (toolCallId: string) => void;
    find: (toolCallId: string) => ToolCallStreamResult | undefined;
  };
  executingToolCalls: {
    add: (toolCallId: string) => void;
    remove: (toolCallId: string) => void;
    isExecuting: (toolCallId?: string) => boolean;
  };
}

const ChatContext = createContext<ChatState | undefined>(undefined);

interface ChatContextProviderProps {
  children: ReactNode;
}

export function ChatContextProvider({ children }: ChatContextProviderProps) {
  const autoApproveGuard = useRef(false);
  const toolEvents = useRef(new ToolEvents()).current;

  const { addToolStreamResult, removeToolStreamResult, findToolStreamResult } =
    useToolStreamResults();

  const { addExecutingToolCall, removeExecutingToolCall, isExecuting } =
    useExecutingToolCalls();

  const value: ChatState = {
    autoApproveGuard,
    toolEvents,
    toolStreamResults: {
      add: addToolStreamResult,
      remove: removeToolStreamResult,
      find: findToolStreamResult,
    },
    executingToolCalls: {
      add: addExecutingToolCall,
      remove: removeExecutingToolCall,
      isExecuting,
    },
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatState(): ChatState {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChatState must be used within a ChatContextProvider");
  }
  return context;
}
