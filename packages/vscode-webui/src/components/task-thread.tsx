import { MessageList } from "@/components/message/message-list";
import { cn } from "@/lib/utils";
import type { Todo } from "@getpochi/tools";
import { formattersNext } from "@ragdoll/common";
import type { Message } from "@ragdoll/livekit";
import { fromV4UIMessage } from "@ragdoll/livekit/v4-adapter";
import type { TaskRunnerState } from "@ragdoll/runner";
import { useEffect, useMemo, useState } from "react";
import { FixedStateChatContextProvider } from "../features/chat/lib/chat-state";

export type TaskThreadSource =
  | {
      type: "task";
      messages: Message[];
      todos: Todo[];
      isLoading?: boolean;
    }
  | {
      type: "taskRunner";
      runner: TaskRunnerState;
    };

export const TaskThread: React.FC<{
  source: TaskThreadSource;
  user?: {
    name: string;
    image?: string | null;
  };
  assistant?: {
    name: string;
    image?: string | null;
  };
  showMessageList?: boolean;
}> = ({ source, user, assistant, showMessageList = true }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
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
      setMessages(sourceTaskRunner.messages.map(fromV4UIMessage));
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
              className={cn("px-0", {
                "mt-2": !renderMessages.length,
              })}
              showUserAvatar={false}
              messages={renderMessages}
              user={user}
              assistant={assistant}
              isLoading={isLoading}
              containerRef={undefined}
              isCompactingNewTask={false}
            />
          </div>
        )}
      </div>
    </FixedStateChatContextProvider>
  );
};

function prepareForRender(messages: Message[]): Message[] {
  // Remove user messages.
  const filteredMessages = messages.filter((x) => x.role !== "user");
  const x = formattersNext.ui(filteredMessages);
  return x;
}
