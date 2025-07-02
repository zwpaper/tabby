import { createContext } from "react";
import type { ToolCallLifeCycle } from "../tool-call-life-cycle";

export interface ChatState {
  autoApproveGuard: React.MutableRefObject<boolean>;
  getToolCallLifeCycle: (key: ToolCallLifeCycleKey) => ToolCallLifeCycle;
  executingToolCalls: ToolCallLifeCycle[];
  completeToolCalls: ToolCallLifeCycle[];
}

export interface ToolCallLifeCycleKey {
  toolName: string;
  toolCallId: string;
  messageId: string;
}

export const ChatContext = createContext<ChatState | undefined>(undefined);
