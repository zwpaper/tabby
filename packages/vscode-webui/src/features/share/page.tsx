import { MessageList } from "@/components/message/message-list";
import { type Theme, useTheme } from "@/components/theme-provider";
import { VSCodeWebProvider } from "@/components/vscode-web-provider";
import { ChatContextProvider } from "@/features/chat";
import { cn } from "@/lib/utils";
import { type Todo, formatters } from "@ragdoll/common";
import type { UIMessage } from "ai";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { TodoList } from "../todo";

export function SharePage() {
  const { setTheme } = useTheme();
  const searchParams = new URLSearchParams(location.search);
  const theme = searchParams.get("theme") || "light";
  const logo = searchParams.get("logo") ?? undefined;
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTheme(theme as Theme);
  }, [theme, setTheme]);

  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [user, setUser] = useState<{ name: string; image?: string | null }>();
  const [todos, setTodos] = useState<Todo[]>([]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (typeof event.data === "object" && event.data?.type === "share") {
        const shareMessage = event.data as ShareMessage;
        setMessages(shareMessage.messages);
        setUser(shareMessage.user);
        setTodos(shareMessage.todos);
      }
    };
    window.addEventListener("message", handler);
    return () => {
      window.removeEventListener("message", handler);
    };
  }, []);

  // Set up ResizeObserver to monitor content height and send updates to parent
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      if (!containerRef.current) return;

      // Send height update to parent window
      window.parent.postMessage(
        {
          type: "resize",
          height: containerRef.current?.clientHeight + 20, // Add some padding
        },
        "*",
      );
    });

    resizeObserver.observe(containerRef.current);

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
        <div ref={containerRef}>
          {/* todo skeleton outside? */}
          {messages.length === 0 ? (
            <div className="flex min-h-screen items-center justify-center">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : (
            <div
              className={cn(
                "grid gap-3",
                todos.length > 0 ? "md:grid-cols-4" : "md:grid-cols-1",
              )}
            >
              <div
                className={cn(
                  "order-1 md:order-1",
                  todos.length > 0 ? "md:col-span-3" : "md:col-span-1",
                )}
              >
                <MessageList
                  logo={logo}
                  user={user}
                  messages={renderMessages}
                  isLoading={false}
                />
              </div>
              {todos.length > 0 && (
                <div className="order-2 md:order-2 md:col-span-1">
                  <TodoList
                    todos={todos}
                    className="[&>.todo-border]:!hidden px-4 md:px-0"
                  >
                    <TodoList.Header disableCollapse={true} title="TODOs" />
                    <TodoList.Items />
                  </TodoList>
                </div>
              )}
            </div>
          )}
        </div>
      </ChatContextProvider>
    </VSCodeWebProvider>
  );
}

type ShareMessage = {
  type: "share";
  messages: UIMessage[]; // Array of messages to be displayed
  user: {
    name: string;
    image?: string | null;
  };
  todos: Todo[];
};
