import { vscodeHost } from "@/lib/vscode";
import { ThreadAbortSignal } from "@quilted/threads";
import { type ClientToolsType, isUserInputTool } from "@ragdoll/tools";
import type { ToolInvocation } from "ai";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import type { ToolProps } from "./types";

export function ToolInvocationPart({
  tool,
  addToolResult,
}: {
  tool: ToolInvocation;
  addToolResult: ({
    toolCallId,
    result,
  }: {
    toolCallId: string;
    result: unknown;
  }) => void;
}) {
  const [approvalStatus, setApprovalStatus] =
    useState<ApprovalStatus>("pending");
  const onResult = useCallback(
    (result: unknown) => {
      addToolResult({ toolCallId: tool.toolCallId, result });
    },
    [addToolResult, tool.toolCallId],
  );
  const { isExecuting } = useVSCodeTool(approvalStatus, tool, onResult);

  const userInputTool = isUserInputTool(tool.toolName);
  const showApproval =
    !userInputTool && approvalStatus === "pending" && !isExecuting;

  const C = Tools[tool.toolName];
  return (
    <div className="flex flex-col gap-1">
      {C ? <C tool={tool} /> : JSON.stringify(tool, null, 2)}
      {isExecuting && <Loader2 className="animate-spin" />}
      {showApproval && <ToolApproval onSubmit={setApprovalStatus} />}
    </div>
  );
}

function ToolApproval({
  onSubmit,
}: {
  onSubmit: (status: ApprovalStatus) => void;
}) {
  const onApprove = () => {
    onSubmit("approved");
  };
  const onReject = () => {
    onSubmit("rejected");
  };
  return (
    <div className="flex gap-2">
      <Button onClick={onApprove}>Approve</Button>
      <Button onClick={onReject}>Reject</Button>
    </div>
  );
}

export const AttemptCompletionTool: React.FC<
  ToolProps<ClientToolsType["attemptCompletion"]>
> = ({ tool: toolCall }) => {
  const { result = "", command = undefined } = toolCall.args || {};
  return (
    <div>
      <span>Task completed: {result}</span>
      {command && <pre>{command}</pre>}
    </div>
  );
};

const Tools: Record<string, React.FC<ToolProps>> = {
  attemptCompletion: AttemptCompletionTool,
};

type ApprovalStatus = "pending" | "approved" | "rejected";

function useVSCodeTool(
  approvalStatus: ApprovalStatus,
  tool: ToolInvocation,
  onResult: (result: unknown) => void,
) {
  const { toolName, args, toolCallId } = tool;
  const abort = useRef(new AbortController());
  const abortSignal = useRef(ThreadAbortSignal.serialize(abort.current.signal));
  const executed = useRef(false);
  const [isExecuting, setIsExecuting] = useState(false);

  // Always update preview view
  useEffect(() => {
    vscodeHost.previewToolCall(toolName, args, {
      toolCallId,
      abortSignal: abortSignal.current,
    });
  }, [args, toolName, toolCallId]);

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
        .then(wrappedOnResult);
    }
  }, [approvalStatus, args, toolName, toolCallId, wrappedOnResult]);

  return {
    isExecuting,
  };
}
