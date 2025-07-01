import type React from "react";
import { useCallback, useEffect } from "react"; // useMemo is now in the hook

import { Button } from "@/components/ui/button";
import { useAutoApproveGuard, useToolCallLifeCycle } from "@/features/chat";
import { useSelectedModels, useToolAutoApproval } from "@/features/settings";
import { useDebounceState } from "@/lib/hooks/use-debounce-state";
import type { PendingToolCallApproval } from "../hooks/use-pending-tool-call-approval";

interface ToolCallApprovalButtonProps {
  pendingApproval: PendingToolCallApproval;
  saveCheckpoint: (toolCallId: string) => Promise<void>;
}

// Component
export const ToolCallApprovalButton: React.FC<ToolCallApprovalButtonProps> = ({
  pendingApproval,
  saveCheckpoint,
}) => {
  const autoApproveGuard = useAutoApproveGuard();

  const lifecycle = useToolCallLifeCycle().getToolCallLifeCycle(
    pendingApproval.tool.toolName,
    pendingApproval.tool.toolCallId,
  );

  const { selectedModel } = useSelectedModels();

  const ToolAcceptText: Record<string, string> = {
    writeToFile: "Save",
    executeCommand: "Run",
    todoWrite: "Continue",
    newTask: "Run",
  };

  const ToolRejectText: Record<string, string> = {
    todoWrite: "<disabled>",
  };

  const ToolAbortText: Record<string, string> = {};

  const acceptText = ToolAcceptText[pendingApproval.name] || "Accept";
  const rejectText = ToolRejectText[pendingApproval.name] || "Reject";
  const abortText = ToolAbortText[pendingApproval.name] || "Stop";

  const onAccept = useCallback(async () => {
    if (lifecycle.status !== "ready") {
      return;
    }

    await saveCheckpoint(pendingApproval.tool.toolCallId);
    lifecycle.execute(pendingApproval.tool.args, {
      model: selectedModel?.id,
    });
  }, [
    pendingApproval.tool,
    lifecycle.status,
    lifecycle.execute,
    selectedModel?.id,
    saveCheckpoint,
  ]);

  const onReject = useCallback(() => {
    if (lifecycle.status !== "ready") {
      return;
    }

    lifecycle.reject();
  }, [lifecycle.status, lifecycle.reject]);

  const isAutoApproved = useToolAutoApproval(
    pendingApproval,
    autoApproveGuard.current,
  );

  useEffect(() => {
    if (isAutoApproved) {
      onAccept();
    }
  }, [isAutoApproved, onAccept]);

  const [showAbort, setShowAbort] = useDebounceState(false, 1_000); // 1 seconds
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
          <Button onClick={onReject} variant="secondary">
            {rejectText}
          </Button>
        )}
      </>
    );
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies(autoApproveGuard): autoApproveGuard is a ref, so it won't change
  const abort = useCallback(() => {
    autoApproveGuard.current = false;
    lifecycle.abort();
  }, [lifecycle]);

  if (showAbort && abortText && lifecycle.status.startsWith("execute")) {
    /*
    Only display the abort button if:
    1. There's executing tool call
    2. The abort text is provided
    3. The showAbort flag is true (delayed for a bit to avoid flashing)
    */
    return <Button onClick={abort}>{abortText}</Button>;
  }

  return null;
};
