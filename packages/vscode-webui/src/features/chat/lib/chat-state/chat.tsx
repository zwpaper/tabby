import { type ReactNode, useRef } from "react";
import { useToolCallLifeCycles } from "../use-tool-call-life-cycles";
import { ChatContext, type ChatState } from "./types";

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
