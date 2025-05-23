import { isAutoInjectTool } from "@ragdoll/tools"; // isUserInputTool is now in the hook
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react"; // useMemo is now in the hook

import { Button } from "@/components/ui/button";
import type { PendingToolCallApproval } from "@/features/approval/hooks/use-pending-tool-call-approval";
import { useVSCodeTool } from "@/lib/hooks/use-vscode-tool";
import { useToolAutoApproval } from "@/lib/stores/settings-store";
// usePendingToolCallApproval is not directly used here anymore, it's used by usePendingApproval

// Type definitions
export type AddToolResultFunctionType = ({
  toolCallId,
  result,
}: {
  toolCallId: string;
  result: unknown;
}) => void;

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
    (errorText = "User rejected tool call") => {
      // Renamed 'error' to 'errorText' to avoid conflict
      if (shouldSkipExecute()) {
        return;
      }
      rejectTool(pendingApproval.tool, errorText);
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
