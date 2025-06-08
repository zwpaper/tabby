import type React from "react";
import { useCallback, useEffect } from "react"; // useMemo is now in the hook

import { Button } from "@/components/ui/button";
import { useAutoApproveGuard, useToolCallLifeCycle } from "@/features/chat";
import { useToolAutoApproval } from "@/features/settings";
import { useDebounceState } from "@/lib/hooks/use-debounce-state";
import type { PendingToolCallApproval } from "../hooks/use-pending-tool-call-approval";

interface ToolCallApprovalButtonProps {
  pendingApproval: PendingToolCallApproval;
}

// Component
export const ToolCallApprovalButton: React.FC<ToolCallApprovalButtonProps> = ({
  pendingApproval,
}) => {
  const autoApproveGuard = useAutoApproveGuard();

  const lifecycle = useToolCallLifeCycle().getToolCallLifeCycle(
    pendingApproval.tool.toolName,
    pendingApproval.tool.toolCallId,
  );

  const ToolAcceptText: Record<string, string> = {
    writeToFile: "Save",
    executeCommand: "Run",
    todoWrite: "Continue",
  };

  const ToolRejectText: Record<string, string> = {
    todoWrite: "<disabled>",
  };

  const ToolAbortText: Record<string, string> = {
    executeCommand: "Stop",
  };

  const acceptText = ToolAcceptText[pendingApproval.name] || "Accept";
  const rejectText = ToolRejectText[pendingApproval.name] || "Reject";
  const abortText = ToolAbortText[pendingApproval.name] || null;

  const onAccept = useCallback(async () => {
    if (lifecycle.status !== "ready") {
      return;
    }

    lifecycle.execute(pendingApproval.tool.args);
  }, [pendingApproval.tool, lifecycle.status, lifecycle.execute]);

  const onReject = useCallback(
    (errorText?: string) => {
      if (lifecycle.status !== "ready") {
        return;
      }

      lifecycle.reject(errorText);
    },
    [lifecycle.status, lifecycle.reject],
  );
  const onRejectByUser = useCallback(() => onReject(), [onReject]);

  const isAutoApproved = useToolAutoApproval(
    pendingApproval.name,
    autoApproveGuard.current,
  );

  useEffect(() => {
    if (isAutoApproved) {
      onAccept();
    }
  }, [isAutoApproved, onAccept]);

  const [showAbort, setShowAbort] = useDebounceState(false, 1_000); // 3 seconds
  useEffect(() => {
    if (lifecycle.status.startsWith("execute")) {
      setShowAbort(true);
      return;
    }
  }, [setShowAbort, lifecycle.status]);

  const showAccept = !isAutoApproved && lifecycle.status === "ready";
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

  if (showAbort && abortText && lifecycle.status.startsWith("execute")) {
    /*
    Only display the abort button if:
    1. There's executing tool call
    2. The abort text is provided
    3. The showAbort flag is true (delayed for a bit to avoid flashing)
    */
    return (
      <Button onClick={() => lifecycle.abort()} variant="secondary">
        {abortText}
      </Button>
    );
  }

  return null;
};
