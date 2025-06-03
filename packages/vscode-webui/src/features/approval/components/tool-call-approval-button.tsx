import { isAutoInjectTool } from "@ragdoll/tools"; // isUserInputTool is now in the hook
import type React from "react";
import { useCallback, useEffect } from "react"; // useMemo is now in the hook

import { Button } from "@/components/ui/button";
import type { PendingToolCallApproval } from "@/features/approval";
import {
  useAutoApproveGuard,
  useStreamToolCallResult,
  useToolCallState,
  useToolEvents,
} from "@/features/chat";
import { useToolAutoApproval } from "@/features/settings";
import { useDebounceState } from "@/lib/hooks/use-debounce-state";
import { useVSCodeTool } from "../hooks/use-vscode-tool";

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
}

// Component
export const ToolCallApprovalButton: React.FC<ToolCallApprovalButtonProps> = ({
  pendingApproval,
  addToolResult,
}) => {
  const autoApproveGuard = useAutoApproveGuard();
  const { addToolStreamResult, removeToolStreamResult } =
    useStreamToolCallResult();
  const { executeTool, rejectTool, abortTool } = useVSCodeTool({
    addToolResult,
    addToolStreamResult,
    removeToolStreamResult,
  });

  const { getToolCallState } = useToolCallState();

  const { listen } = useToolEvents();
  useEffect(() => {
    return listen("abortTool", ({ toolCallId }) => {
      if (getToolCallState(toolCallId) === "executing") {
        abortTool();
      }
    });
  }, [listen, abortTool, getToolCallState]);

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

  const onAccept = useCallback(async () => {
    if (getToolCallState(pendingApproval.tool.toolCallId) !== undefined) {
      return;
    }

    await executeTool(pendingApproval.tool);
  }, [getToolCallState, pendingApproval, executeTool]);

  const onReject = useCallback(
    (errorText = "User rejected tool call") => {
      if (getToolCallState(pendingApproval.tool.toolCallId) !== undefined) {
        return;
      }

      rejectTool(pendingApproval.tool, errorText);
    },
    [getToolCallState, pendingApproval, rejectTool],
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
    if (getToolCallState(pendingApproval.tool.toolCallId) === "executing") {
      setShowAbort(true);
      return;
    }
  }, [getToolCallState, setShowAbort, pendingApproval.tool.toolCallId]);

  const showAccept =
    !isAutoApproved &&
    getToolCallState(pendingApproval.tool.toolCallId) === undefined;
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

  if (
    showAbort &&
    abortText &&
    getToolCallState(pendingApproval.tool.toolCallId) === "executing"
  ) {
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
