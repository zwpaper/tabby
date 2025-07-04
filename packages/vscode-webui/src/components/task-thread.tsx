import { MessageList } from "@/components/message/message-list";
import { cn } from "@/lib/utils";
import type { Todo } from "@ragdoll/db";
import type { TaskRunnerState } from "@ragdoll/runner";
import type { UIMessage } from "ai";
import { useEffect, useState } from "react";
import { FixedStateChatContextProvider } from "../features/chat/lib/chat-state";

export type TaskThreadSource =
  | {
      type: "task";
      messages: UIMessage[];
      todos: Todo[];
      isLoading?: boolean;
    }
  | {
      type: "taskRunner";
      runner: TaskRunnerState;
    };

export const TaskThread: React.FC<{
  source: TaskThreadSource;
  user?: { name: string; image?: string | null };
  logo?: string;
}> = ({ source, user, logo }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);

  const sourceTask = source.type === "task" ? source : undefined;
  useEffect(() => {
    if (!sourceTask) {
      return;
    }

    setIsLoading(sourceTask.isLoading ?? false);
    setMessages(sourceTask.messages);
    setTodos(sourceTask.todos);
  }, [sourceTask]);

  const sourceTaskRunner =
    source.type === "taskRunner" ? source.runner : undefined;
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
          logo={logo}
          isLoading={isLoading}
          containerRef={undefined}
        />
      </div>
    </FixedStateChatContextProvider>
  );
};
