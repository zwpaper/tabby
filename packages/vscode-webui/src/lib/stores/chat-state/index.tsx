import type React from "react";
import { type ReactNode, createContext, useContext, useRef } from "react";
import {
  type ToolEventPayloads,
  type ToolEventType,
  ToolEvents,
} from "./tool-events";
import { useExecutingToolCalls } from "./use-executing-tool-calls";
import {
  type ToolCallStreamResult,
  useToolStreamResults,
} from "./use-tool-stream-results";

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

const ChatStateContext = createContext<ChatState | undefined>(undefined);

interface ChatStateProviderProps {
  children: ReactNode;
}

export function ChatStateProvider({ children }: ChatStateProviderProps) {
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

  return (
    <ChatStateContext.Provider value={value}>
      {children}
    </ChatStateContext.Provider>
  );
}

function useChatState(): ChatState {
  const context = useContext(ChatStateContext);
  if (context === undefined) {
    throw new Error("useChatState must be used within a ChatStateProvider");
  }
  return context;
}

// Create a custom hook to use the tool events specifically
export function useToolEvents() {
  const { toolEvents } = useChatState();
  return toolEvents;
}

export function useAutoApproveGuard() {
  const { autoApproveGuard } = useChatState();
  return autoApproveGuard;
}

// Hook to use the stream tool call result functionality
export function useStreamToolCallResult() {
  const { toolStreamResults } = useChatState();

  return {
    addToolStreamResult: toolStreamResults.add,
    removeToolStreamResult: toolStreamResults.remove,
    findToolStreamResult: toolStreamResults.find,
  };
}

// Hook to use the executing tool calls functionality
export function useExecutingToolCallIds() {
  const { executingToolCalls } = useChatState();

  return {
    addExecutingToolCall: executingToolCalls.add,
    removeExecutingToolCall: executingToolCalls.remove,
    isExecuting: executingToolCalls.isExecuting,
  };
}

// Re-export types for backward compatibility
export type { ToolCallStreamResult, ToolEventType, ToolEventPayloads };
