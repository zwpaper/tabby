import {
  isAutoInjectTool,
  isExecuteCommandToolStreamCall,
} from "@ragdoll/tools"; // isUserInputTool is now in the hook
import type React from "react";
import { useCallback, useEffect, useRef } from "react"; // useMemo is now in the hook

import { Button } from "@/components/ui/button";
import type { PendingToolCallApproval } from "@/features/approval/hooks/use-pending-tool-call-approval";
import { useDebounceState } from "@/lib/hooks/use-debounce-state";
import { useVSCodeTool } from "@/lib/hooks/use-vscode-tool";
import {
  useAutoApproveGuard,
  useStreamToolCallResult,
  useToolEvents,
} from "@/lib/stores/chat-state";
import { useToolAutoApproval } from "@/lib/stores/settings-store";

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
}

// Component
export const ToolCallApprovalButton: React.FC<ToolCallApprovalButtonProps> = ({
  pendingApproval,
  addToolResult,
  setIsExecuting,
  executingToolCallId,
}) => {
  const autoApproveGuard = useAutoApproveGuard();
  const { addToolStreamResult, removeToolStreamResult } =
    useStreamToolCallResult();
  const { executeTool, rejectTool, abortTool } = useVSCodeTool({
    addToolResult,
    addToolStreamResult,
    removeToolStreamResult,
    setIsExecuting,
  });

  const { listen } = useToolEvents();
  useEffect(() => {
    return listen("abortTool", ({ toolCallId }) => {
      if (toolCallId === executingToolCallId) {
        abortTool();
      }
    });
  }, [listen, abortTool, executingToolCallId]);

  const ToolAcceptText: Record<string, string> = {
    writeToFile: "Save",
    executeCommand: "Run",
    todoWrite: "Continue",
  };

  const ToolRejectText: Record<string, string> = {
    todoWrite: "<disabled>",
  };

  const ToolAbortText: Record<string, string> = {};

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
      if (!isExecuteCommandToolStreamCall(pendingApproval.tool)) {
        setIsExecuting(false);
      }
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
    autoApproveGuard.current,
  );
  const isAutoRejected = isAutoInjectTool(pendingApproval.name);

  useEffect(() => {
    if (isAutoApproved) {
      onAccept();
    } else if (isAutoRejected) {
      onReject();
    }
  }, [isAutoApproved, isAutoRejected, onAccept, onReject]);

  const [showAbort, setShowAbort] = useDebounceState(false, 3_000); // 3 seconds
  useEffect(() => {
    setShowAbort(!!executingToolCallId);
  }, [executingToolCallId, setShowAbort]);

  const showAccept = !isAutoApproved && !executingToolCallId;
  if (showAccept) {
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
