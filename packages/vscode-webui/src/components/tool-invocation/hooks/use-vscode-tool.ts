import { vscodeHost } from "@/lib/vscode";
import type { UseChatHelpers } from "@ai-sdk/react";
import { ThreadAbortSignal } from "@quilted/threads";
import type { ToolInvocation } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ApprovalStatus } from "../types";

export function useVSCodeTool(
  status: UseChatHelpers["status"],
  approvalStatus: ApprovalStatus,
  tool: ToolInvocation,
  onResult: (result: unknown) => void,
) {
  const { state, toolName, args, toolCallId } = tool;
  const abort = useRef(new AbortController());
  const abortSignal = useRef(ThreadAbortSignal.serialize(abort.current.signal));
  const executed = useRef(false);
  const [isExecuting, setIsExecuting] = useState(false);

  // Always update preview view
  useEffect(() => {
    if (approvalStatus === "rejected") return;
    if (state === "result") return;

    vscodeHost.previewToolCall(toolName, args, {
      toolCallId,
      abortSignal: abortSignal.current,
    });
  }, [state, approvalStatus, args, toolName, toolCallId]);

  const wrappedOnResult = useCallback(
    (result: unknown) => {
      try {
        onResult(result);
      } finally {
        abort.current.abort();
        setIsExecuting(false);
      }
    },
    [onResult],
  );

  useEffect(() => {
    if (status !== "ready") return;
    if (state !== "call") return;
    if (approvalStatus === "pending") return;
    if (executed.current) return;

    executed.current = true;
    if (approvalStatus === "rejected") {
      wrappedOnResult({ error: "User rejected the tool call" });
    } else if (approvalStatus === "approved") {
      setIsExecuting(true);
      new Promise((resolve) => setTimeout(resolve, 1000))
        .then(() =>
          vscodeHost.executeToolCall(toolName, args, {
            toolCallId,
            abortSignal: abortSignal.current,
          }),
        )
        .then(wrappedOnResult)
        .catch((error) => {
          wrappedOnResult({
            error: `Error executing tool call: ${error?.message}`,
          });
        });
    }
  }, [
    status,
    state,
    approvalStatus,
    args,
    toolName,
    toolCallId,
    wrappedOnResult,
  ]);

  return {
    isExecuting,
  };
}
