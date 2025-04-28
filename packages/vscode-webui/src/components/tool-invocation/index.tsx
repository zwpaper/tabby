import { vscodeHost } from "@/lib/vscode";
import { ThreadAbortSignal } from "@quilted/threads";
import { type ClientToolsType, isUserInputTool } from "@ragdoll/tools";
import type { ToolInvocation } from "ai";
import { useEffect, useRef, useState } from "react";
import { MessageMarkdown } from "../message-markdown";
import { Button } from "../ui/button";
import type { ToolProps } from "./types";

type ApprovalStatus = "pending" | "approved" | "rejected";

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
  const toolExecuted = useRef<boolean>(
    tool.state === "result" || isUserInputTool(tool.toolName),
  );
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>(
    toolExecuted.current ? "approved" : "pending",
  );
  const abort = useRef(new AbortController());
  useEffect(() => {
    if (toolExecuted.current) return;
    if (approvalStatus === "pending") return;

    toolExecuted.current = true;

    if (approvalStatus === "rejected") {
      addToolResult({
        toolCallId: tool.toolCallId,
        result: "Tool execution rejected by user",
      });
    } else if (approvalStatus === "approved") {
      vscodeHost
        .executeToolCall(tool.toolName, tool.args, {
          toolCallId: tool.toolCallId,
          abortSignal: ThreadAbortSignal.serialize(abort.current.signal),
        })
        .then((result) => {
          addToolResult({
            toolCallId: tool.toolCallId,
            result,
          });
        })
        .catch(console.error);
    }
  }, [tool, addToolResult, approvalStatus]);

  const markdown = `\`\`\`\n${JSON.stringify(tool, null, 2)}\n\`\`\``;
  const C = Tools[tool.toolName];
  return (
    <div className="flex flex-col gap-1">
      <span>Tool Executed: {toolExecuted.current ? "✅" : "❌"}</span>
      {C ? <C tool={tool} /> : <MessageMarkdown>{markdown}</MessageMarkdown>}
      {approvalStatus === "pending" && (
        <ToolApproval onSubmit={setApprovalStatus} />
      )}
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
