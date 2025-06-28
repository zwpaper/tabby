import { MessageMarkdown } from "@/components/message";
import { Badge } from "@/components/ui/badge";
import { useToolCallLifeCycle } from "@/features/chat";
import { cn } from "@/lib/utils";
import type { Todo } from "@ragdoll/db";
import type { ClientToolsType } from "@ragdoll/tools";
import { useEffect, useState } from "react";
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
  const { description } = tool.args || {};
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
    <span className={cn("flex items-center gap-2")}>
      <p>
        <Badge
          variant="secondary"
          className={cn("px-1 py-0", {
            "animate-pulse": isExecuting,
          })}
        >
          Subtask
        </Badge>
        <span className="ml-2">{description}</span>
      </p>
    </span>
  );

  return (
    <ExpandableToolContainer
      title={title}
      expandableDetail={
        <div className="overflow-hidden rounded-lg">
          {todos && todos.length > 0 && (
            <div className="my-1 flex flex-col rounded-sm border px-2 py-1">
              {todos
                .filter((x) => x.status !== "cancelled")
                .map((todo) => (
                  <span
                    key={todo.id}
                    className={cn("text-sm", {
                      "line-through": todo.status === "completed",
                    })}
                  >
                    • {todo.content}
                  </span>
                ))}
            </div>
          )}
          {(result || error) && (
            <MessageMarkdown isMinimalView>
              {result || error || ""}
            </MessageMarkdown>
          )}
        </div>
      }
    />
  );
};
