import { MessageMarkdown } from "@/components/message";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToolCallLifeCycle } from "@/features/chat";
import type { ClientToolsType } from "@ragdoll/tools";
import { HighlightedText } from "../highlight-text";
import { StatusIcon } from "../status-icon";
import { ExpandableToolContainer } from "../tool-container";
import type { ToolProps } from "../types";

export const newTaskTool: React.FC<ToolProps<ClientToolsType["newTask"]>> = ({
  tool,
  isExecuting,
}) => {
  const lifecycle = useToolCallLifeCycle().getToolCallLifeCycle(
    tool.toolName,
    tool.toolCallId,
  );
  const { description, prompt } = tool.args || {};

  let result = undefined;
  if (tool.state === "result" && "result" in tool.result) {
    result = tool.result.result;
  }
  let error = undefined;
  if (tool.state === "result" && "error" in tool.result) {
    error = tool.result.error;
  }

  const { streamingResult } = lifecycle;

  if (streamingResult && streamingResult.toolName !== "newTask") {
    throw new Error("Unexpected streaming result for newTask tool");
  }

  const title = (
    <>
      <StatusIcon isExecuting={isExecuting} tool={tool} />
      <span className="ml-2">
        Task
        <HighlightedText>{description}</HighlightedText>
      </span>
    </>
  );
  return (
    <ExpandableToolContainer
      title={title}
      expandableDetail={
        <div className="overflow-hidden rounded-lg border bg-[var(--vscode-editor-background)]">
          <ScrollArea className="p-4" viewportClassname="max-h-52">
            <MessageMarkdown isMinimalView>{prompt || ""}</MessageMarkdown>
          </ScrollArea>
          {(result || error) && (
            <>
              <hr className="my-2 border-[var(--vscode-editorWidget-border)]" />
              <ScrollArea className="p-4" viewportClassname="max-h-52">
                <MessageMarkdown isMinimalView>
                  {result || error || ""}
                </MessageMarkdown>
              </ScrollArea>
            </>
          )}
        </div>
      }
    />
  );
};
