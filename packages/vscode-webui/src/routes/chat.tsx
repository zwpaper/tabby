import { MessageMarkdown } from "@/components/message-markdown";
import Pending from "@/components/pending";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { type Message, useChat } from "@ai-sdk/react";
import type { ChatRequest as RagdollChatRequest } from "@ragdoll/server";
import { fromUIMessage, toUIMessages } from "@ragdoll/server/message-utils";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  Loader2,
  PaperclipIcon,
  StopCircleIcon,
} from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { KeyboardEventHandler, MutableRefObject } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { z } from "zod";

const searchSchema = z.object({
  taskId: z.number().optional(),
});

export const Route = createFileRoute("/chat")({
  validateSearch: (search) => searchSchema.parse(search),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    if (deps.taskId) {
      const resp = await apiClient.api.tasks[":id"].$get({
        param: {
          id: deps.taskId?.toString(),
        },
      });
      return resp.json();
    }

    return null;
  },
  component: RouteComponent,
  pendingComponent: Pending,
});

function RouteComponent() {
  const loaderData = Route.useLoaderData();
  const taskId = useRef<number | undefined>(loaderData?.id);
  const { auth: authData } = Route.useRouteContext();
  const initialMessages = toUIMessages(
    loaderData?.conversation?.messages || [],
  );
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const {
    data,
    error,
    messages,
    handleSubmit,
    input,
    handleInputChange,
    status,
    stop,
  } = useChat({
    initialMessages,
    api: apiClient.api.chat.stream.$url().toString(),
    experimental_prepareRequestBody: (req) => prepareRequestBody(taskId, req),
    headers: {
      Authorization: `Bearer ${authData.session.token}`,
    },
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    if (
      taskId.current === undefined &&
      typeof data?.[0] === "object" &&
      data[0] &&
      "id" in data[0] &&
      typeof data[0].id === "number"
    ) {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      taskId.current = data[0].id;
    }
  }, [data, queryClient]);

  const isLoading = status === "streaming" || status === "submitted";

  const renderMessages = useMemo(() => {
    const x = [...messages];

    if (isLoading && messages[messages.length - 1]?.role !== "assistant") {
      // Add a placeholder message to show the spinner
      x.push({
        id: "",
        role: "assistant",
        content: "",
        parts: [],
      });
    }

    return x;
  }, [messages, isLoading]);

  const { history } = useRouter();

  const submitOnEnter: KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      formRef.current?.requestSubmit();
      e.preventDefault();
    }
  };

  useLayoutEffect(() => {
    const scrollToBottom = () => {
      const container = messagesContainerRef.current;
      if (!container) return;

      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth",
      });
    };
    // scroll to bottom when a user message is sent
    if (isLoading) {
      scrollToBottom();
    }
  }, [isLoading]);

  return (
    <div className="flex flex-col h-screen p-4">
      <div className="flex items-center border-b border-[var(--border)] mb-4 py-2">
        <div className="flex-shrink-0">
          <Button
            onClick={() => history.back()}
            variant="ghost"
            size="sm"
            className="flex items-center gap-1"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            <span>Back</span>
          </Button>
        </div>
        <div className="flex-1 flex justify-center items-center gap-2 text-sm">
          {taskId.current ? (
            <span className="font-medium">
              TASK-{String(taskId.current).padStart(3, "0")}
            </span>
          ) : (
            <span className="font-medium">New Task</span>
          )}
          <span className="text-muted-foreground">{status}</span>
          {isLoading && <Loader2 className="size-4 animate-spin" />}
        </div>
        {/* Invisible spacer to balance the header and center the task info */}
        <div className="flex-shrink-0 invisible" aria-hidden="true">
          <Button variant="ghost" size="sm" className="flex items-center gap-1">
            <ArrowLeftIcon className="h-4 w-4" />
            <span>Back</span>
          </Button>
        </div>
      </div>
      <div className="text-destructive">{error?.message}</div>
      <div
        className="flex-1 overflow-y-auto mb-4 space-y-4"
        ref={messagesContainerRef}
      >
        {renderMessages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className="p-2 rounded-lg">
              <div
                className={cn("flex items-center gap-2", {
                  "justify-end": m.role === "user",
                })}
              >
                {m.role === "user" ? (
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={authData.user.image ?? undefined} />
                    <AvatarFallback>{authData.user.name}</AvatarFallback>
                  </Avatar>
                ) : (
                  <Avatar className="h-8 w-8 border p-1 bg-[var(--vscode-chat-avatarBackground)]">
                    <AvatarImage
                      // FIXME(jueliang): use local static resources
                      src={"https://app.getpochi.com/logo192.png"}
                    />
                    <AvatarFallback>Assistant</AvatarFallback>
                  </Avatar>
                )}
                {m.role !== "user" && <strong>Assistant</strong>}
                {isLoading &&
                  m.id === renderMessages[renderMessages.length - 1].id && (
                    <Loader2 className="size-4 animate-spin ml-2" />
                  )}
              </div>
              {m.parts.map((part, index) => {
                if (part.type === "text") {
                  return (
                    <MessageMarkdown
                      key={index}
                      className={m.role === "user" ? "max-w-[80vw]" : undefined}
                    >
                      {part.text}
                    </MessageMarkdown>
                  );
                }
                return null;
              })}
            </div>
          </div>
        ))}
      </div>
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="bg-input p-2 rounded-sm border border-[var(--input-border)] focus-within:border-ring transition-color duration-300"
        onClick={(e) => {
          e.stopPropagation();
          inputRef.current?.focus();
        }}
        onKeyDown={() => {}}
      >
        <TextareaAutosize
          ref={inputRef}
          value={input}
          minRows={2}
          maxRows={6}
          autoFocus
          onChange={handleInputChange}
          onKeyDown={submitOnEnter}
          placeholder="Type your message..."
          className="w-full !border-none !outline-none focus-visible:ring-0 resize-none text-[var(--vscode-input-foreground)]"
        />
        <div className="flex justify-end items-center pt-2 gap-3">
          <Button variant="ghost" size="icon" className="h-6 w-6">
            <PaperclipIcon className="h-3 w-3" />
          </Button>
          <Button
            type="button"
            size="icon"
            disabled={!isLoading && !input}
            className="p-0 h-6 w-6 rounded-md transition-opacity"
            onClick={() => {
              if (isLoading) {
                stop();
              } else {
                formRef.current?.requestSubmit();
              }
            }}
          >
            {isLoading ? (
              <StopCircleIcon className="h-3 w-3" />
            ) : (
              <ArrowRightIcon className="h-3 w-3" />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

function prepareRequestBody(
  taskId: MutableRefObject<number | undefined>,
  request: {
    messages: Message[];
  },
): RagdollChatRequest | null {
  return {
    id: taskId.current?.toString(),
    message: fromUIMessage(request.messages[request.messages.length - 1]),
  };
}
