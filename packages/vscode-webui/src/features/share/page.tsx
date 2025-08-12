import { MessageList } from "@/components/message/message-list";
import { VSCodeWebProvider } from "@/components/vscode-web-provider";
import { ChatContextProvider } from "@/features/chat";
import { cn } from "@/lib/utils";
import { ZodTodo } from "@getpochi/tools";
import { formattersNext } from "@ragdoll/common";
import type { Message } from "@ragdoll/livekit";
import type { createChannel } from "bidc";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import z from "zod";
import { ErrorMessageView } from "../chat/components/error-message-view";
import { TodoList } from "../todo";

type SharePageProps = Pick<
  ReturnType<typeof createChannel>,
  "receive" | "send"
>;

export function SharePage({ receive, send }: SharePageProps) {
  const shareData = useShareData(receive);

  // Set up ResizeObserver to monitor content height and send updates to parent
  const monitorHeight = useCallback(
    (element: HTMLElement | null) => {
      if (!element) return;

      const resizeObserver = new ResizeObserver(() => {
        send({
          type: "resize",
          height: element.clientHeight,
        } satisfies ResizeEvent);
      });

      resizeObserver.observe(element);

      // Also observe document.body for better coverage
      if (document.body) {
        resizeObserver.observe(document.body);
      }

      return () => resizeObserver.disconnect();
    },
    [send],
  );

  const {
    messages = [],
    todos = [],
    user,
    assistant,
    isLoading = true,
    error,
  } = shareData || {};

  const renderMessages = useMemo(() => formattersNext.ui(messages), [messages]);
  return (
    <VSCodeWebProvider>
      <ChatContextProvider>
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
                  user={user}
                  assistant={assistant}
                  messages={renderMessages}
                  isLoading={isLoading}
                />
                <ErrorMessageView error={error ?? undefined} />
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
      </ChatContextProvider>
    </VSCodeWebProvider>
  );
}

const ZodResizeEvent = z.object({
  type: z.literal("resize"),
  height: z.number(),
});

type ResizeEvent = z.infer<typeof ZodResizeEvent>;

const ZodShareEvent = z.object({
  type: z.literal("share"),
  messages: z.array(z.custom<Message>()).optional(),
  user: z
    .object({
      name: z.string(),
      image: z.string().optional().nullable(),
    })
    .optional(),
  assistant: z
    .object({
      name: z.string(),
      image: z.string().optional().nullable(),
    })
    .optional(),
  todos: z.array(ZodTodo).optional(),
  isLoading: z.boolean().optional(),
  error: z
    .object({
      message: z.string(),
    })
    .optional()
    .nullable(),
});

type ShareEvent = z.infer<typeof ZodShareEvent>;

function useShareData(receive: SharePageProps["receive"]) {
  const [data, setData] = useState<ShareEvent>();
  useEffect(() => {
    receive((data) => {
      setData(ZodShareEvent.parse(data));
    });
  }, [receive]);
  return data;
}
