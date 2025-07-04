import { MessageList } from "@/components/message/message-list";
import { cn } from "@/lib/utils";
import { formatters } from "@ragdoll/common";
import type { Todo } from "@ragdoll/db";
import type { TaskRunnerState } from "@ragdoll/runner";
import type { UIMessage } from "ai";
import { useEffect, useMemo, useState } from "react";
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
  showMessageList?: boolean;
}> = ({ source, user, logo, showMessageList = true }) => {
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
  const renderMessages = useMemo(() => prepareForRender(messages), [messages]);

  return (
    <FixedStateChatContextProvider taskRunnerState={sourceTaskRunner}>
      <div className="flex flex-col">
        {todos && todos.length > 0 && (
          <div className="my-1 flex flex-col px-2 py-1">
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
        {showMessageList && (
          <div className="my-1 rounded-xs border border-[var(--vscode-borderColor)]">
            <MessageList
              className="px-0"
              showUserAvatar={false}
              messages={renderMessages}
              user={user}
              logo={logo}
              isLoading={isLoading}
              containerRef={undefined}
            />
          </div>
        )}
      </div>
    </FixedStateChatContextProvider>
  );
};

function prepareForRender(messages: UIMessage[]): UIMessage[] {
  // Remove user messages.
  const filteredMessages = messages.filter((x) => x.role !== "user");
  const x = formatters.ui(filteredMessages);
  return x;
}
