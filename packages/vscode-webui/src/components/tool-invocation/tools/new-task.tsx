import { MessageMarkdown } from "@/components/message";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToolCallLifeCycle } from "@/features/chat";
import { TodoList } from "@/features/todo";
import type { Todo } from "@ragdoll/db";
import type { ClientToolsType } from "@ragdoll/tools";
import { useEffect, useState } from "react";
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
  const [todos, setTodos] = useState<Todo[]>([]);

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

  useEffect(() => {
    const runnerState = streamingResult?.result;
    if (runnerState && runnerState.state !== "initial") {
      setTodos(runnerState.todos);
    }
  }, [streamingResult?.result]);

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
          <ScrollArea className="p-4" viewportClassname="max-h-100">
            <ScrollArea
              className="mb-2 rounded-lg bg-card p-4"
              viewportClassname="max-h-52"
            >
              <MessageMarkdown isMinimalView>{prompt || ""}</MessageMarkdown>
            </ScrollArea>
            {todos && todos.length > 0 && (
              <TodoList todos={todos} className="[&>.todo-border]:!hidden">
                <TodoList.Header
                  disableCollapse={false}
                  disableInProgressTodoTitle={true}
                />
                <TodoList.Items className="py-0" />
              </TodoList>
            )}
            {(result || error) && (
              <MessageMarkdown isMinimalView>
                {result || error || ""}
              </MessageMarkdown>
            )}
          </ScrollArea>
        </div>
      }
    />
  );
};
