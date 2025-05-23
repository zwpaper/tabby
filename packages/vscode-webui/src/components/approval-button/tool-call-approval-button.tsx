import type { ClientToolsType } from "@ragdoll/tools";
import { isAutoInjectTool, isUserInputTool } from "@ragdoll/tools";
import type { ToolInvocation, UIMessage } from "ai";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useVSCodeTool } from "@/lib/hooks/use-vscode-tool";
import { useToolAutoApproval } from "@/lib/stores/settings-store";

// Type definitions
export type AddToolResultFunctionType = ({
  toolCallId,
  result,
}: {
  toolCallId: string;
  result: unknown;
}) => void;

export interface PendingToolCallApproval {
  name: keyof ClientToolsType;
  tool: ToolInvocation;
}

export function usePendingToolCallApproval({
  error,
  messages,
}: { error?: Error; messages: UIMessage[] }) {
  const [isExecuting, setIsExecuting] = useState(false);

  const pendingApproval = useMemo((): PendingToolCallApproval | undefined => {
    if (error) {
      return undefined;
    }

    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role !== "assistant") {
      return undefined;
    }

    for (const part of lastMessage.parts) {
      if (
        part.type === "tool-invocation" &&
        part.toolInvocation.state === "call" &&
        !isUserInputTool(part.toolInvocation.toolName)
      ) {
        return {
          name: part.toolInvocation.toolName as keyof ClientToolsType,
          tool: part.toolInvocation,
        };
      }
    }
    return undefined;
  }, [error, messages]);

  const executingToolCallId = useMemo(() => {
    if (pendingApproval && isExecuting) {
      return pendingApproval.tool.toolCallId;
    }
    return undefined;
  }, [pendingApproval, isExecuting]);

  // Reset isExecuting when pendingApproval changes or disappears
  useEffect(() => {
    if (!pendingApproval) {
      setIsExecuting(false);
    }
  }, [pendingApproval]);

  return { pendingApproval, setIsExecuting, executingToolCallId };
}

interface ToolCallApprovalButtonProps {
  pendingApproval: PendingToolCallApproval;
  addToolResult: AddToolResultFunctionType;
  setIsExecuting: React.Dispatch<React.SetStateAction<boolean>>;
  executingToolCallId?: string;
  chatHasFinishedOnce: boolean;
}

// Component
export const ToolCallApprovalButton: React.FC<ToolCallApprovalButtonProps> = ({
  pendingApproval,
  addToolResult,
  setIsExecuting,
  executingToolCallId,
  chatHasFinishedOnce,
}) => {
  const { executeTool, rejectTool, abortTool } = useVSCodeTool({
    addToolResult,
  });

  const ToolAcceptText: Record<string, string> = {
    writeToFile: "Save",
    executeCommand: "Run",
    todoWrite: "Continue",
  };

  const ToolRejectText: Record<string, string> = {
    todoWrite: "<disabled>",
  };

  const ToolAbortText: Record<string, string> = {
    executeCommand: "Complete",
  };

  const acceptText = ToolAcceptText[pendingApproval.name] || "Accept";
  const rejectText = ToolRejectText[pendingApproval.name] || "Reject";
  const abortText = ToolAbortText[pendingApproval.name] || null;

  const executed = useRef(false);
  const shouldSkipExecute = useCallback(() => {
    if (executed.current) {
      return true;
    }
    executed.current = true;
    return false;
  }, []);

  const onAccept = useCallback(async () => {
    if (shouldSkipExecute()) {
      return;
    }

    try {
      setIsExecuting(true);
      await executeTool(pendingApproval.tool);
    } finally {
      setIsExecuting(false);
    }
  }, [shouldSkipExecute, pendingApproval, executeTool, setIsExecuting]);

  const onReject = useCallback(
    (error = "User rejected tool call") => {
      if (shouldSkipExecute()) {
        return;
      }
      rejectTool(pendingApproval.tool, error);
    },
    [shouldSkipExecute, pendingApproval, rejectTool],
  );
  const onRejectByUser = useCallback(() => onReject(), [onReject]);

  const isAutoApproved = useToolAutoApproval(
    pendingApproval.name,
    chatHasFinishedOnce,
  );
  const isAutoRejected = isAutoInjectTool(pendingApproval.name);

  useEffect(() => {
    if (isAutoApproved) {
      onAccept();
    } else if (isAutoRejected) {
      onReject();
    }
  }, [isAutoApproved, isAutoRejected, onAccept, onReject]);

  const [showAbort, setShowAbort] = useState(false);

  useEffect(() => {
    setShowAbort(false);

    if (executingToolCallId) {
      const timer = setTimeout(() => {
        setShowAbort(true);
      }, 10_000); // 10 seconds

      return () => clearTimeout(timer);
    }
  }, [executingToolCallId]);

  if (!executingToolCallId) {
    return (
      <>
        <Button onClick={onAccept}>{acceptText}</Button>
        {rejectText !== "<disabled>" && (
          <Button onClick={onRejectByUser} variant="secondary">
            {rejectText}
          </Button>
        )}
      </>
    );
  }

  if (showAbort && abortText && executingToolCallId) {
    /*
    Only display the abort button if:
    1. There's executing tool call
    2. The abort text is provided
    3. The showAbort flag is true (delayed for a bit to avoid flashing)
    */
    return (
      <Button onClick={abortTool} variant="secondary">
        {abortText}
      </Button>
    );
  }

  return null;
};
