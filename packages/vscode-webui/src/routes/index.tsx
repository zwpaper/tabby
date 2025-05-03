import { MessageMarkdown } from "@/components/message-markdown";
import { ModelSelect } from "@/components/model-select";
import Pending from "@/components/pending";
import { FormEditor } from "@/components/prompt-form/form-editor";
import {
  AutoRejectTool,
  ToolInvocationPart,
} from "@/components/tool-invocation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/auth-client";
import { useEnvironment } from "@/lib/hooks/use-environment";
import { useSelectedModels } from "@/lib/hooks/use-models";
import { useChatStore } from "@/lib/stores/chat-store";
import { type Message, type UseChatHelpers, useChat } from "@ai-sdk/react";
import {
  type UIMessage,
  isAssistantMessageWithCompletedToolCalls,
} from "@ai-sdk/ui-utils";
import type {
  Environment,
  ChatRequest as RagdollChatRequest,
} from "@ragdoll/server";
import { fromUIMessage, toUIMessages } from "@ragdoll/server/message-utils";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import type { TextPart } from "ai";
import { Loader2, SendHorizonal, StopCircleIcon } from "lucide-react";
import {
  type MutableRefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { z } from "zod";

import "@/components/prompt-form/prompt-form.css";
import { AutoApproveMenu } from "@/components/settings/auto-approve-menu";
import { Separator } from "@/components/ui/separator";
import { isAutoInjectTool } from "@ragdoll/tools";

const searchSchema = z.object({
  taskId: z
    .number()
    .or(z.enum(["new"]))
    .optional(),
});

export const Route = createFileRoute("/")({
  validateSearch: (search) => searchSchema.parse(search),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps, context }) => {
    if (!context.auth) {
      throw redirect({ to: "/sign-in" });
    }
    if (typeof deps.taskId === "number") {
      const resp = await apiClient.api.tasks[":id"].$get({
        param: {
          id: deps.taskId.toString(),
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
  const clearPendingApproval = useChatStore((x) => x.clearPendingApproval);
  useLayoutEffect(() => {
    clearPendingApproval();
  }, [clearPendingApproval]);

  const loaderData = Route.useLoaderData();
  const taskId = useRef<number | undefined>(loaderData?.id);
  useEffect(() => {
    taskId.current = loaderData?.id;
  }, [loaderData]);

  const { auth: authData } = Route.useRouteContext();
  const { environment, reload: reloadEnvironment } = useEnvironment();
  const {
    models,
    selectedModel,
    isLoading: isModelsLoading,
  } = useSelectedModels();
  const initialMessages = toUIMessages(
    loaderData?.conversation?.messages || [],
  );
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const {
    data,
    error,
    messages,
    setMessages,
    reload,
    setInput,
    append,
    input,
    status,
    stop,
    addToolResult,
    handleSubmit,
  } = useChat({
    initialMessages,
    api: apiClient.api.chat.stream.$url().toString(),
    experimental_prepareRequestBody: (req) =>
      prepareRequestBody(taskId, req, environment, selectedModel?.id),
    headers: {
      Authorization: `Bearer ${authData.session.token}`,
    },
  });

  const wrappedHandleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      reloadEnvironment();
      handleSubmit(e);
    },
    [handleSubmit, reloadEnvironment],
  );

  const updateSelectedModelId = useChatStore((x) => x.updateSelectedModelId);
  const handleSelectModel = (v: string) => {
    updateSelectedModelId(v);
  };

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

  const setInputAndFocus = (input: string) => {
    setInput(input);
  };

  const updatePendingApproval = useChatStore((x) => x.updatePendingApproval);
  const retry = useRetry({ messages, append, setMessages, reload });
  useEffect(() => {
    if (error) {
      updatePendingApproval({
        name: "retry",
        resolve: (approved) => {
          if (approved) {
            retry();
          }
        },
      });
    }
  }, [error, updatePendingApproval, retry]);

  return (
    <div className="flex flex-col h-screen px-4">
      <div
        className="flex-1 overflow-y-auto mb-2 space-y-4"
        ref={messagesContainerRef}
      >
        {renderMessages.map((m, messageIndex) => (
          <div key={m.id} className="flex flex-col">
            <div className="py-2 rounded-lg">
              <div className="flex items-center gap-2">
                {m.role === "user" ? (
                  <Avatar className="size-7">
                    <AvatarImage src={authData.user.image ?? undefined} />
                    <AvatarFallback>{authData.user.name}</AvatarFallback>
                  </Avatar>
                ) : (
                  <Avatar className="size-7 border p-1 bg-[var(--vscode-chat-avatarBackground)]">
                    <AvatarImage
                      // FIXME(jueliang): use local static resources
                      src={"https://app.getpochi.com/logo192.png"}
                    />
                    <AvatarFallback>Pochi</AvatarFallback>
                  </Avatar>
                )}
                <strong>
                  {m.role === "user" ? authData.user.name : "Pochi"}
                </strong>
                {isLoading &&
                  m.id === renderMessages[renderMessages.length - 1].id && (
                    <Loader2 className="size-4 animate-spin ml-2" />
                  )}
              </div>
              <div className="ml-1 mt-3 flex flex-col gap-2">
                {m.parts.map((part, index) => (
                  <Part
                    key={index}
                    message={m}
                    isLastMessage={messageIndex === renderMessages.length - 1}
                    part={part}
                    addToolResult={addToolResult}
                    setInput={setInputAndFocus}
                    status={status}
                  />
                ))}
              </div>
            </div>
            {messageIndex < renderMessages.length - 1 && <Separator />}
          </div>
        ))}
      </div>
      <div className="text-red-400 text-center mb-2">{error?.message}</div>
      <ApprovalButton show={!isLoading} />
      <AutoApproveMenu />
      <FormEditor
        input={input}
        setInput={setInput}
        onSubmit={wrappedHandleSubmit}
        isLoading={isLoading}
        formRef={formRef}
      >
        {taskId.current && (
          <span className="text-xs absolute top-1 right-1 text-foreground/80">
            TASK-{String(taskId.current).padStart(3, "0")}
          </span>
        )}
      </FormEditor>
      <div className="flex mb-2 justify-between items-center pt-2 gap-3">
        <ModelSelect
          value={selectedModel?.id}
          models={models}
          isLoading={isModelsLoading}
          onChange={handleSelectModel}
          triggerClassName="py-0 h-6"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={isModelsLoading || (!isLoading && !input)}
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
            <StopCircleIcon className="size-4" />
          ) : (
            <SendHorizonal className="size-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

function Part({
  message,
  isLastMessage,
  part,
  addToolResult,
  setInput,
  status,
}: {
  message: Message;
  isLastMessage: boolean;
  part: NonNullable<Message["parts"]>[number];
  addToolResult: ({
    toolCallId,
    result,
  }: {
    toolCallId: string;
    result: unknown;
  }) => void;
  setInput: (prompt: string) => void;
  status: UseChatHelpers["status"];
}) {
  if (part.type === "text") {
    return <TextPartUI message={message} part={part} />;
  }

  if (part.type === "step-start") {
    return null;
  }

  if (part.type === "tool-invocation") {
    if (isAutoInjectTool(part.toolInvocation.toolName)) {
      <AutoRejectTool
        tool={part.toolInvocation}
        addToolResult={addToolResult}
      />;
    }
    return (
      <ToolInvocationPart
        tool={part.toolInvocation}
        addToolResult={isLastMessage ? addToolResult : undefined}
        setInput={setInput}
        status={status}
      />
    );
  }

  return <div>{JSON.stringify(part)}</div>;
}

function TextPartUI({ message, part }: { message: Message; part: TextPart }) {
  return (
    <MessageMarkdown
      className={message.role === "user" ? "max-w-[80vw]" : undefined}
    >
      {part.text}
    </MessageMarkdown>
  );
}

function prepareRequestBody(
  taskId: MutableRefObject<number | undefined>,
  request: {
    messages: Message[];
  },
  environment: MutableRefObject<Environment | null>,
  model: string | undefined,
): RagdollChatRequest {
  const message = fromUIMessage(request.messages[request.messages.length - 1]);
  const triggerError =
    message.parts[0].type === "text" &&
    message.parts[0].text.includes("RAGDOLL_DEBUG_TRIGGER_ERROR");
  return {
    id: taskId.current?.toString(),
    model: triggerError ? "fake-model" : model,
    message: fromUIMessage(request.messages[request.messages.length - 1]),
    environment: environment.current || undefined,
  };
}

function ApprovalButton({ show }: { show: boolean }) {
  const { pendingApproval, resolvePendingApproval } = useChatStore();
  if (!show || !pendingApproval) return;

  const ToolAcceptText: Record<string, string> = {
    retry: "Retry",
    writeToFile: "Save",
    executeCommand: "Run",
  };

  const ToolRejectText: Record<string, string> = {
    retry: "Cancel",
  };

  const acceptText = ToolAcceptText[pendingApproval.name] || "Accept";
  const rejectText = ToolRejectText[pendingApproval.name] || "Reject";
  return (
    <div className="flex [&>button]:flex-1 [&>button]:rounded-sm gap-3 mb-2">
      <Button onClick={() => resolvePendingApproval(true)}>{acceptText}</Button>
      <Button onClick={() => resolvePendingApproval(false)} variant="secondary">
        {rejectText}
      </Button>
    </div>
  );
}

function useRetry({
  messages,
  setMessages,
  append,
  reload,
}: {
  messages: Message[];
  append: UseChatHelpers["append"];
  setMessages: UseChatHelpers["setMessages"];
  reload: UseChatHelpers["reload"];
}) {
  const retryRequest = useCallback(async () => {
    if (messages.length === 0) {
      return;
    }

    const lastMessage = messages[messages.length - 1];
    if (isAssistantMessageWithCompletedToolCalls(lastMessage as UIMessage)) {
      setMessages(messages.slice(0, -1));
      append(lastMessage);
    }

    return await reload();
  }, [messages, setMessages, append, reload]);

  return retryRequest;
}
