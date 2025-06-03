import type React from "react";
import { type ReactNode, createContext, useContext, useRef } from "react";
import {
  type ToolCallState,
  useToolCallStates,
} from "./hooks/use-tool-call-states";
import {
  type ToolCallStreamResult,
  useToolStreamResults,
} from "./hooks/use-tool-stream-results";
import { ToolEvents } from "./lib/tool-events";

interface ChatState {
  autoApproveGuard: React.MutableRefObject<boolean>;
  toolEvents: React.RefObject<ToolEvents>;
  addToolStreamResult: (result: ToolCallStreamResult) => void;
  removeToolStreamResult: (toolCallId: string) => void;
  findToolStreamResult: (
    toolCallId: string,
  ) => ToolCallStreamResult | undefined;
  setToolCallState: (toolCallId: string, state: ToolCallState) => void;
  getToolCallState: (toolCallId: string) => ToolCallState | undefined;
  hasToolCallState: (state: ToolCallState) => boolean;
}

const ChatContext = createContext<ChatState | undefined>(undefined);

interface ChatContextProviderProps {
  children: ReactNode;
}

export function ChatContextProvider({ children }: ChatContextProviderProps) {
  const autoApproveGuard = useRef(false);
  const toolEvents = useRef(new ToolEvents());

  const { addToolStreamResult, removeToolStreamResult, findToolStreamResult } =
    useToolStreamResults();

  const { getToolCallState, setToolCallState, hasToolCallState } =
    useToolCallStates();

  const value: ChatState = {
    autoApproveGuard,
    toolEvents,
    addToolStreamResult,
    removeToolStreamResult,
    findToolStreamResult,
    getToolCallState,
    setToolCallState,
    hasToolCallState,
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

export function useToolCallState() {
  const { setToolCallState, getToolCallState, hasToolCallState } =
    useChatState();
  return { setToolCallState, getToolCallState, hasToolCallState };
}

export function useStreamToolCallResult() {
  const { addToolStreamResult, removeToolStreamResult, findToolStreamResult } =
    useChatState();
  return {
    addToolStreamResult,
    removeToolStreamResult,
    findToolStreamResult,
  };
}
