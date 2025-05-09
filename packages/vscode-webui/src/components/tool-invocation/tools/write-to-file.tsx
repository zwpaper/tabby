import { CodeBlock } from "@/components/message";
import { vscodeHost } from "@/lib/vscode";
import type { ClientToolsType } from "@ragdoll/tools";
import { ChevronRight } from "lucide-react";
import { useCallback, useState } from "react";
import { FileBadge } from "../file-badge";
import { StatusIcon } from "../status-icon";
import type { ToolProps } from "../types";

export const writeToFileTool: React.FC<
  ToolProps<ClientToolsType["writeToFile"]>
> = ({ tool, isExecuting }) => {
  const handleClick = useCallback(() => {
    vscodeHost.previewToolCall(tool.toolName, tool.args, {
      toolCallId: tool.toolCallId,
      state: tool.state,
    });
  }, [tool.args, tool.toolCallId, tool.toolName, tool.state]);

  const { path } = tool.args || {};

  const result =
    tool.state === "result" && !("error" in tool.result)
      ? tool.result
      : undefined;
  return (
    <span className="text-sm">
      <StatusIcon isExecuting={isExecuting} tool={tool} />
      <span className="ml-2" />
      Writing
      {path && (
        <FileBadge
          className="ml-2"
          path={path}
          onClick={tool.state !== "result" ? handleClick : undefined}
        />
      )}
      {result?.userEdits && <UserEdits userEdits={result.userEdits} />}
    </span>
  );
};

function UserEdits({ userEdits }: { userEdits: string }) {
  const [showDetails, setShowDetails] = useState(true);
  return (
    <>
      <span
        className="float-right cursor-pointer pl-4"
        onClick={() => setShowDetails(!showDetails)}
      >
        {showDetails ? (
          <ChevronRight className="size-3 rotate-90" />
        ) : (
          <ChevronRight className="size-3 rotate-180" />
        )}
      </span>
      {showDetails && (
        <div className="my-2 ml-1 flex flex-col">
          <CodeBlock className="" language="diff" value={userEdits} />
          <p className="mt-1 self-center text-xs italic">
            You have made the above edits
          </p>
        </div>
      )}
    </>
  );
}
