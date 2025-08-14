import { MessageList } from "@/components/message/message-list";
import { cn } from "@/lib/utils";
import type { Todo } from "@getpochi/tools";
import { formatters } from "@ragdoll/common";
import type { Message } from "@ragdoll/livekit";
import { useEffect, useMemo, useState } from "react";

export type TaskThreadSource = {
  type: "task";
  messages: Message[];
  todos: Todo[];
  isLoading?: boolean;
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

  const renderMessages = useMemo(() => prepareForRender(messages), [messages]);

  return (
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
          />
        </div>
      )}
    </div>
  );
};

function prepareForRender(messages: Message[]): Message[] {
  // Remove user messages.
  const filteredMessages = messages.filter((x) => x.role !== "user");
  const x = formatters.ui(filteredMessages);
  return x;
}
