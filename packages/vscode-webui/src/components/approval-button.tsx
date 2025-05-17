import type { ClientToolsType } from "@ragdoll/tools";
import { isAutoInjectTool, isUserInputTool } from "@ragdoll/tools";
import type { ToolInvocation, UIMessage } from "ai";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useVSCodeTool } from "@/lib/hooks/use-vscode-tool";
import { useToolAutoApproval } from "@/lib/stores/settings-store";
import { vscodeHost } from "@/lib/vscode";

// Type definitions
type AddToolResultFunctionType = ({
  toolCallId,
  result,
}: {
  toolCallId: string;
  result: unknown;
}) => void;

export type PendingApproval =
  | {
      name: "retry";
    }
  | {
      name: keyof ClientToolsType;
      tool: ToolInvocation;
    };

export function usePendingApproval({
  error,
  messages,
}: { error?: Error; messages: UIMessage[] }) {
  const [isExecuting, setIsExecuting] = useState(false);

  const pendingApproval = useMemo((): PendingApproval | undefined => {
    if (error) {
      return {
        name: "retry",
      };
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
    if (pendingApproval && pendingApproval.name !== "retry" && isExecuting) {
      return pendingApproval.tool.toolCallId;
    }
    return undefined;
  }, [pendingApproval, isExecuting]);

  // Reset isExecuting when pendingApproval changes or disappears
  useEffect(() => {
    if (!pendingApproval || pendingApproval.name === "retry") {
      setIsExecuting(false);
    }
  }, [pendingApproval]);

  return { pendingApproval, setIsExecuting, executingToolCallId };
}

interface ApprovalButtonProps {
  isLoading: boolean;
  pendingApproval?: PendingApproval;
  retry: () => void;
  addToolResult: AddToolResultFunctionType;
  setIsExecuting: React.Dispatch<React.SetStateAction<boolean>>;
  executingToolCallId?: string;
  chatHasFinishedOnce: boolean;
}

// Hook
function usePreviewToolCall() {
  const [error, setError] = useState<string | undefined>(undefined);
  const previewToolCall = useCallback(async (tool: ToolInvocation) => {
    const { state, args, toolCallId, toolName } = tool;
    if (state === "result") return;
    const result = await vscodeHost.previewToolCall(toolName, args, {
      toolCallId,
      state,
    });
    if (result?.error && state === "call") {
      setError((prev) => {
        if (prev) return prev;
        return result.error;
      });
    }
  }, []);
  return { error, previewToolCall };
}

// Component
export const ApprovalButton: React.FC<ApprovalButtonProps> = ({
  isLoading,
  pendingApproval,
  retry,
  addToolResult,
  setIsExecuting,
  executingToolCallId,
  chatHasFinishedOnce,
}) => {
  if (isLoading || !pendingApproval) return null;

  const { executeTool, rejectTool, abortTool } = useVSCodeTool({
    addToolResult,
  });

  const ToolAcceptText: Record<string, string> = {
    retry: "Retry",
    writeToFile: "Save",
    executeCommand: "Run",
  };

  const ToolRejectText: Record<string, string> = {
    retry: "Cancel",
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

  const { previewToolCall, error: previewToolCallError } = usePreviewToolCall();
  useEffect(() => {
    if (pendingApproval.name !== "retry" && !executed.current) {
      previewToolCall(pendingApproval.tool);
    }
  }, [pendingApproval, previewToolCall]);

  const onAccept = useCallback(async () => {
    if (pendingApproval.name === "retry") {
      retry();
    } else {
      if (shouldSkipExecute()) {
        return;
      }

      try {
        setIsExecuting(true);
        await executeTool(pendingApproval.tool);
      } finally {
        setIsExecuting(false);
      }
    }
  }, [shouldSkipExecute, pendingApproval, retry, executeTool, setIsExecuting]);

  const onReject = useCallback(
    (error = "User rejected tool call") => {
      if (pendingApproval.name !== "retry") {
        if (shouldSkipExecute()) {
          return;
        }
        rejectTool(pendingApproval.tool, error);
      }
    },
    [shouldSkipExecute, pendingApproval, rejectTool],
  );
  const onRejectByUser = useCallback(() => onReject(), [onReject]);

  const isAutoApproved = useToolAutoApproval(pendingApproval.name);
  const isAutoRejected = isAutoInjectTool(pendingApproval.name);

  useEffect(() => {
    if (isAutoApproved && chatHasFinishedOnce) {
      onAccept();
    } else if (isAutoRejected) {
      onReject();
    } else if (previewToolCallError) {
      onReject(previewToolCallError);
    }
  }, [
    isAutoApproved,
    isAutoRejected,
    previewToolCallError,
    onAccept,
    onReject,
    chatHasFinishedOnce,
  ]);

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

  let body: React.ReactNode;
  if (!executingToolCallId) {
    body = (
      <>
        <Button onClick={onAccept}>{acceptText}</Button>
        {pendingApproval.name !== "retry" && (
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
    body = (
      <Button onClick={abortTool} variant="secondary">
        {abortText}
      </Button>
    );
  }

  if (!body) return null; // If no body content, render nothing

  return (
    <div className="mb-2 flex gap-3 [&>button]:flex-1 [&>button]:rounded-sm">
      {body}
    </div>
  );
};
