import { MessageList } from "@/components/message/message-list";
import { useResourceURI } from "@/lib/hooks/use-resource-uri";
import { cn } from "@/lib/utils";
import { toUIMessages } from "@ragdoll/common";
import type { Todo } from "@ragdoll/db";
import type { Task, TaskRunnerState } from "@ragdoll/runner";
import type { UIMessage } from "ai";
import { useEffect, useState } from "react";
import { FixedStateChatContextProvider } from "../features/chat/lib/chat-state";

export const TaskThread: React.FC<{
  user?: { name: string; image?: string | null };
  taskSource:
    | {
        task?: Task;
        isLoading?: boolean;
      }
    | {
        runner: TaskRunnerState;
      };
}> = ({ user, taskSource }) => {
  const resourceUri = useResourceURI();
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);

  const sourceTaskRunner =
    "runner" in taskSource ? taskSource.runner : undefined;
  useEffect(() => {
    if (!sourceTaskRunner) {
      return;
    }

    if (sourceTaskRunner.state === "initial") {
      setIsLoading(true);
    } else {
      setMessages(sourceTaskRunner.messages);
      setTodos(sourceTaskRunner.todos);

      if (
        sourceTaskRunner.state === "running" &&
        (sourceTaskRunner.progress.type === "loading-task" ||
          sourceTaskRunner.progress.type === "sending-message") &&
        sourceTaskRunner.progress.phase === "begin"
      ) {
        setIsLoading(true);
      } else {
        setIsLoading(false);
      }
    }
  }, [sourceTaskRunner]);

  const sourceTaskLoader = "task" in taskSource ? taskSource : undefined;
  useEffect(() => {
    if (!sourceTaskLoader) {
      return;
    }

    setIsLoading(sourceTaskLoader.isLoading ?? false);
    if (sourceTaskLoader.task) {
      const task = sourceTaskLoader.task;
      setMessages(toUIMessages(task.conversation?.messages ?? []));
      setTodos(task.todos ?? []);
    }
  }, [sourceTaskLoader]);

  return (
    <FixedStateChatContextProvider taskRunnerState={sourceTaskRunner}>
      <div className="flex flex-col">
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
        <MessageList
          messages={messages}
          user={user}
          logo={resourceUri?.logo128}
          isLoading={isLoading}
          containerRef={undefined}
        />
      </div>
    </FixedStateChatContextProvider>
  );
};
