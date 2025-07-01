import { createContext } from "react";
import type { ToolCallLifeCycle } from "../tool-call-life-cycle";

export interface ChatState {
  autoApproveGuard: React.MutableRefObject<boolean>;
  getToolCallLifeCycle: (
    toolName: string,
    toolCallId: string,
  ) => ToolCallLifeCycle;
  executingToolCalls: ToolCallLifeCycle[];
  completeToolCalls: ToolCallLifeCycle[];
}

export const ChatContext = createContext<ChatState | undefined>(undefined);
