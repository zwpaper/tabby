import { MessageList } from "@/components/message/message-list";
import { VSCodeWebProvider } from "@/components/vscode-web-provider";
import { ChatContextProvider } from "@/features/chat";
import { cn } from "@/lib/utils";
import { formatters } from "@ragdoll/common";
import type { Todo } from "@ragdoll/tools";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TodoList } from "../todo";

export function SharePage() {
  const searchParams = new URLSearchParams(location.search);
  const logo = searchParams.get("logo") ?? undefined;

  const [isInitialized, setIsInitialized] = useState(false);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [user, setUser] = useState<{ name: string; image?: string | null }>();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const queryClient = useMemo(() => new QueryClient(), []);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (typeof event.data === "object" && event.data?.type === "share") {
        const shareMessage = event.data as ShareMessage;
        setMessages(shareMessage.messages ?? []);
        setUser(shareMessage.user);
        setTodos(shareMessage.todos ?? []);
        setIsLoading(!!shareMessage.isLoading);
        setIsInitialized(true);
      }
    };
    window.addEventListener("message", handler);
    return () => {
      window.removeEventListener("message", handler);
    };
  }, []);

  useEffect(() => {
    if (isInitialized) {
      window.parent.postMessage(
        {
          type: "messagesLoaded",
        },
        "*",
      );
    }
  }, [isInitialized]);

  // Set up ResizeObserver to monitor content height and send updates to parent
  const monitorHeight = useCallback((element: HTMLElement | null) => {
    if (!element) return;

    const resizeObserver = new ResizeObserver(() => {
      // Send height update to parent window
      window.parent.postMessage(
        {
          type: "resize",
          height: element.clientHeight + 20, // Add some padding
        },
        "*",
      );
    });

    resizeObserver.observe(element);

    // Also observe document.body for better coverage
    if (document.body) {
      resizeObserver.observe(document.body);
    }

    return () => resizeObserver.disconnect();
  }, []);

  const renderMessages = useMemo(() => formatters.ui(messages), [messages]);
  return (
    <VSCodeWebProvider>
      <ChatContextProvider>
        <QueryClientProvider client={queryClient}>
          <div>
            {/* todo skeleton outside? */}
            {messages.length === 0 ? (
              <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="size-6 animate-spin" />
              </div>
            ) : (
              <div
                ref={monitorHeight}
                className={cn("grid grid-cols-1 gap-3", {
                  "md:grid-cols-4": todos && todos.length > 0,
                })}
              >
                <div
                  className={cn("col-span-1", {
                    "md:col-span-3": todos && todos.length > 0,
                  })}
                >
                  <MessageList
                    logo={logo}
                    user={user}
                    messages={renderMessages}
                    isLoading={isLoading}
                  />
                </div>
                {todos && todos.length > 0 && (
                  <div className="col-span-1">
                    <TodoList
                      todos={todos}
                      className="[&>.todo-border]:!hidden px-4 md:px-0"
                    >
                      <TodoList.Header
                        disableCollapse={true}
                        disableInProgressTodoTitle={true}
                      />
                      <TodoList.Items />
                    </TodoList>
                  </div>
                )}
              </div>
            )}
          </div>
        </QueryClientProvider>
      </ChatContextProvider>
    </VSCodeWebProvider>
  );
}

type ShareMessage = {
  type: "share";
  messages: UIMessage[] | undefined; // Array of messages to be displayed
  user:
    | {
        name: string;
        image?: string | null;
      }
    | undefined;
  todos: Todo[] | undefined;
  isLoading: boolean | undefined;
};
