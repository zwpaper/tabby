import { type ReactNode, useRef } from "react";
import { useCheckpoints } from "../use-checkpoints";
import { useToolCallLifeCycles } from "../use-tool-call-life-cycles";
import { ChatContext, type ChatState } from "./types";

interface ChatContextProviderProps {
  children: ReactNode;
}

export function ChatContextProvider({ children }: ChatContextProviderProps) {
  const autoApproveGuard = useRef(false);

  const { checkpoint, storeCheckpointsIntoMessages } = useCheckpoints();

  const { executingToolCalls, getToolCallLifeCycle, completeToolCalls } =
    useToolCallLifeCycles({ checkpoint });

  const value: ChatState = {
    autoApproveGuard,
    getToolCallLifeCycle,
    executingToolCalls,
    completeToolCalls,
    storeCheckpointsIntoMessages,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
