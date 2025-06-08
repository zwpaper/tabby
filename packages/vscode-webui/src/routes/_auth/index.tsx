import { ModelSelect } from "@/components/model-select";
import { FormEditor } from "@/components/prompt-form/form-editor";
import { Button } from "@/components/ui/button";
import {
  ChatContextProvider,
  useAutoApproveGuard,
  useToolCallLifeCycle,
} from "@/features/chat";
import { ChatEventProvider } from "@/features/chat";
import { useEnableReasoning, useSelectedModels } from "@/features/settings";
import { apiClient } from "@/lib/auth-client";
import { useIsAtBottom } from "@/lib/hooks/use-is-at-bottom";
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "@ai-sdk/ui-utils";
import type { Environment, Todo } from "@ragdoll/common";
import { formatters, fromUIMessage, toUIMessages } from "@ragdoll/common";
import type { ChatRequest as RagdollChatRequest } from "@ragdoll/server";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { Editor } from "@tiptap/react";
import type { Attachment } from "ai";
import type { InferResponseType } from "hono/client";
import {
  ImageIcon,
  Loader2,
  SendHorizonal,
  StopCircleIcon,
} from "lucide-react";
import type React from "react";
import {
  type MutableRefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { z } from "zod";

import { DevModeButton } from "@/components/dev-mode-button"; // Added import
import { DevRetryCountdown } from "@/components/dev-retry-countdown";
import { EmptyChatPlaceholder } from "@/components/empty-chat-placeholder";
import { ErrorMessage } from "@/components/error-message";
import { ImagePreviewList } from "@/components/image-preview-list";
import { MessageList } from "@/components/message/message-list";
import { PreviewTool } from "@/components/preview-tool";
import { ActiveSelectionBadge } from "@/components/prompt-form/active-selection-badge";
import { PublicShareButton } from "@/components/public-share-button";
import "@/components/prompt-form/prompt-form.css";
import { TokenUsage } from "@/components/token-usage";
import { WorkspaceRequiredPlaceholder } from "@/components/workspace-required-placeholder";
import {
  ApprovalButton,
  ReadyForRetryError,
  useApprovalAndRetry,
} from "@/features/approval";
import { AutoApproveMenu } from "@/features/settings";
import { LegacyTodoList, useTodos } from "@/features/todo";
import { DefaultModelId } from "@/lib/constants";
import { useAddCompleteToolCalls } from "@/lib/hooks/use-add-complete-tool-calls";
import { useAutoResume } from "@/lib/hooks/use-auto-resume";
import { useCurrentWorkspace } from "@/lib/hooks/use-current-workspace";
import { useImageUpload } from "@/lib/hooks/use-image-upload";
import { useMcp } from "@/lib/hooks/use-mcp";
import { useResourceURI } from "@/lib/hooks/use-resource-uri";

import { vscodeHost } from "@/lib/vscode";
import type { DataPart } from "@ragdoll/common";

const searchSchema = z.object({
  taskId: z
    .number()
    .or(z.enum(["new"]))
    .optional(),
  ts: z.number().optional(),
});

export const Route = createFileRoute("/_auth/")({
  validateSearch: (search) => searchSchema.parse(search),
  component: RouteComponent,
});

function RouteComponent() {
  const { taskId: taskIdFromRoute, ts = Date.now() } = Route.useSearch();
  const key =
    typeof taskIdFromRoute === "number"
      ? `task-${taskIdFromRoute}`
      : `new-${ts}`;

  const { data: loaderData, isFetching: isTaskLoading } = useQuery({
    queryKey: ["task", taskIdFromRoute],
    queryFn: async () => {
      if (typeof taskIdFromRoute === "number") {
        const resp = await apiClient.api.tasks[":id"].$get({
          param: {
            id: taskIdFromRoute.toString(),
          },
        });
        return resp.json();
      }
      return null;
    },
    refetchOnWindowFocus: false,
    enabled: typeof taskIdFromRoute === "number",
  });

  return (
    <ChatContextProvider key={key}>
      <Chat loaderData={loaderData || null} isTaskLoading={isTaskLoading} />
    </ChatContextProvider>
  );
}

type Task = NonNullable<
  InferResponseType<(typeof apiClient.api.tasks)[":id"]["$get"]>
>;

interface ChatProps {
  loaderData: Task | null;
  isTaskLoading: boolean;
}

function Chat({ loaderData, isTaskLoading }: ChatProps) {
  const autoApproveGuard = useAutoApproveGuard();
  const taskId = useRef<number | undefined>(loaderData?.id);
  const uid = useRef<string | undefined>(loaderData?.uid);
  const [totalTokens, setTotalTokens] = useState<number>(
    loaderData?.totalTokens || 0,
  );

  const isBatchEvaluationTask = loaderData?.event?.type === "batch:evaluation";

  useEffect(() => {
    taskId.current = loaderData?.id;
    uid.current = loaderData?.uid;
    if (loaderData) {
      setTotalTokens(loaderData.totalTokens || 0);
    }
  }, [loaderData]);

  useEffect(() => {
    if (isBatchEvaluationTask) {
      autoApproveGuard.current = true;
    }
  }, [isBatchEvaluationTask, autoApproveGuard]);

  const { data: currentWorkspace, isFetching } = useCurrentWorkspace();
  const isWorkspaceActive = !!currentWorkspace;
  const { auth: authData } = Route.useRouteContext();

  const {
    models,
    selectedModel,
    isLoading: isModelsLoading,
    updateSelectedModelId,
  } = useSelectedModels();
  const initialMessages = toUIMessages(
    loaderData?.conversation?.messages || [],
  );

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // Error that will auto-dismiss after a few seconds
  const [autoDismissError, setAutoDismissError] = useState<Error | undefined>(
    undefined,
  );

  // Auto-dismiss error after 5 seconds
  useEffect(() => {
    if (autoDismissError) {
      const timer = setTimeout(() => {
        setAutoDismissError(undefined);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [autoDismissError]);

  // Use the unified image upload hook
  const {
    files,
    isUploading: isUploadingImages,
    error: uploadImageError,
    fileInputRef,
    removeFile: handleRemoveImage,
    clearError: clearUploadImageError,
    upload,
    cancelUpload,
    handleFileSelect,
    handlePaste: handlePasteImage,
  } = useImageUpload({
    token: authData.session.token,
  });

  const todosRef = useRef<Todo[] | undefined>(undefined);
  const buildEnvironment = useCallback(async () => {
    return {
      todos: todosRef.current,
      ...(await vscodeHost.readEnvironment()),
    } satisfies Environment;
  }, []);

  const { toolset: mcpToolSet } = useMcp();

  const latestHttpCode = useRef<number | undefined>(undefined);
  const {
    data,
    setData,
    error,
    messages,
    setMessages,
    reload,
    setInput,
    append,
    input,
    status,
    stop: stopChat,
    addToolResult,
    experimental_resume,
  } = useChat({
    /*
     * DO NOT SET throttle - it'll cause messages got re-written after the chat became ready state.
     */
    // experimental_throttle: 100,
    initialMessages,
    api: apiClient.api.chat.stream.$url().toString(),
    onFinish: (_, { finishReason }) => {
      vscodeHost.capture({
        event: "chatFinish",
        properties: {
          modelId: selectedModel?.id,
          finishReason,
        },
      });

      // Allow auto approve once user has submitted a message
      autoApproveGuard.current = true;
    },
    onError: () => {
      autoApproveGuard.current = true;
    },
    experimental_prepareRequestBody: (req) =>
      prepareRequestBody(taskId, req, selectedModel?.id),
    fetch: async (url, options) => {
      // Clear the data when a new request is made
      setData(undefined);
      const resp = await fetch(url, {
        ...options,
        body:
          options?.body &&
          JSON.stringify({
            ...JSON.parse(options.body as string),
            // Inject the environment variables into the request body
            environment: await buildEnvironment(),
            // Inject reasoning configuration
            reasoning: enableReasoning.current ? { enabled: true } : undefined,
            mcpToolSet,
          }),
      });
      // If the task is already streaming, resume the stream
      latestHttpCode.current = resp.status;
      return resp;
    },
    headers: {
      Authorization: `Bearer ${authData.session.token}`,
    },
  });

  const {
    todos,
    isEditMode,
    draftTodos,
    hasDirtyChanges,
    enterEditMode,
    exitEditMode,
    saveTodos,
    updateTodoStatus,
  } = useTodos({
    initialTodos: loaderData?.todos,
    messages,
    todosRef,
  });

  const wrappedSaveTodos = useCallback(() => {
    saveTodos();
    append({
      role: "user",
      content:
        "<user-reminder>I have updated the to-do list and provided it within environment details. Please review them and adjust the plan accordingly. NEVER WORK ON TASKS THAT HAS BEEN MARKED AS COMPLETED OR CANCELLED.</user-reminder>",
    });
  }, [saveTodos, append]);

  useAutoResume({
    autoResume:
      !isTaskLoading &&
      loaderData?.status === "streaming" &&
      initialMessages.length > 0 &&
      initialMessages.length === messages.length,
    initialMessages,
    experimental_resume,
    setMessages,
    data,
  });

  const wrappedHandleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!allowSendMessage) return;

    if (files.length > 0) {
      try {
        const uploadedImages: Attachment[] = await upload();

        append({
          role: "user",
          content: !input.trim() ? " " : input, // use space to keep parts not empty
          experimental_attachments: uploadedImages,
        });

        setInput("");
      } catch (error) {
        // Error is already handled by the hook
        return;
      }
    } else if (input.trim()) {
      // Text-only submissions
      clearUploadImageError();
      append({
        role: "user",
        content: input,
      });
      setInput("");
    }
  };

  const handleStop = () => {
    // If user abort anything, we should disable auto-approval
    autoApproveGuard.current = false;

    if (isUploadingImages) {
      cancelUpload();
    } else if (isLoading) {
      stopChat();
    } else if (pendingApproval?.name === "retry") {
      pendingApproval.stopCountdown();
    }
  };

  const enableReasoning = useEnableReasoning();

  const handleSelectModel = (v: string) => {
    updateSelectedModelId(v);
  };

  useNewTaskHandler({ data, taskId, uid });

  useTokenUsageUpdater({
    data,
    setTotalTokens,
  });

  const editorRef = useRef<Editor | null>(null);

  const renderMessages = useMemo(() => formatters.ui(messages), [messages]);

  const { pendingApproval, retry } = useApprovalAndRetry({
    error,
    messages,
    status,
    append,
    setMessages,
    reload,
    experimental_resume,
    latestHttpCode,
  });

  usePendingModelAutoStart({
    enabled: status === "ready" && messages.length === 1,
    task: loaderData,
    retry,
  });

  const { hasExecutingToolCall: isExecuting } = useToolCallLifeCycle();
  const isLoading = status === "streaming" || status === "submitted";

  // Base busy state used by multiple conditions (excluding isLoading for submit logic)
  const isBusyCore = isTaskLoading || isModelsLoading || isExecuting;
  const isBusy = isBusyCore || isLoading;

  const allowSendMessage = !(isBusy || isEditMode);
  const showEditTodos = !isBusy;
  const isSubmitDisabled =
    isBusyCore || isEditMode || (!isLoading && !input && files.length === 0);

  useScrollToBottom({
    messagesContainerRef,
    isLoading,
    hasPendingApproval: !!pendingApproval,
  });

  const resourceUri = useResourceURI();

  // Display errors with priority: 1. autoDismissError, 2. uploadImageError, 3. error pending retry approval
  const displayError =
    autoDismissError ||
    uploadImageError ||
    (pendingApproval?.name === "retry" ? pendingApproval.error : undefined);

  // Only allow adding tool results when not loading
  const allowAddToolResult = !(isLoading || isTaskLoading || isEditMode);

  useAddCompleteToolCalls({
    messages,
    addToolResult: allowAddToolResult ? addToolResult : undefined,
  });

  return (
    <ChatEventProvider append={isLoading ? () => {} : append}>
      <div className="flex h-screen flex-col">
        <PreviewTool
          messages={renderMessages}
          // Only allow adding tool results when not loading
        />

        {renderMessages.length === 0 &&
          (isTaskLoading ? (
            <div className="flex h-full w-full items-center justify-center">
              <Loader2 className="animate-spin" />
            </div>
          ) : (
            <EmptyChatPlaceholder />
          ))}
        {renderMessages.length > 0 && <div className="h-4" />}
        <MessageList
          messages={renderMessages}
          user={authData.user}
          logo={resourceUri?.logo128}
          isLoading={isLoading || isTaskLoading}
          containerRef={messagesContainerRef}
        />
        <div className="flex flex-col px-4">
          <ErrorMessage error={displayError} />
          {!isWorkspaceActive ? (
            <WorkspaceRequiredPlaceholder
              isFetching={isFetching}
              className="mb-12"
            />
          ) : (
            <>
              <ApprovalButton pendingApproval={pendingApproval} retry={retry} />
              {todos && todos.length > 0 && (
                <LegacyTodoList
                  className="mt-2"
                  todos={todos}
                  status={status}
                  isEditMode={isEditMode}
                  draftTodos={draftTodos}
                  hasDirtyChanges={hasDirtyChanges}
                  enterEditMode={enterEditMode}
                  exitEditMode={exitEditMode}
                  saveTodos={wrappedSaveTodos}
                  updateTodoStatus={updateTodoStatus}
                  showEdit={showEditTodos}
                />
              )}
              <AutoApproveMenu />
              {files.length > 0 && (
                <ImagePreviewList
                  files={files}
                  onRemove={handleRemoveImage}
                  isUploading={isUploadingImages}
                />
              )}
              <FormEditor
                input={input}
                setInput={setInput}
                onSubmit={wrappedHandleSubmit}
                isLoading={isLoading || isExecuting}
                formRef={formRef}
                editorRef={editorRef}
                onPaste={handlePasteImage}
              >
                <ActiveSelectionBadge
                  onClick={() => {
                    editorRef.current?.commands.insertContent(" @");
                  }}
                />
                <DevRetryCountdown
                  pendingApproval={pendingApproval}
                  status={status}
                />
              </FormEditor>

              {/* Hidden file input for image uploads */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*"
                multiple
                className="hidden"
              />

              <div className="my-2 flex shrink-0 justify-between gap-5 overflow-x-hidden">
                <div className="flex items-center gap-2 overflow-x-hidden truncate">
                  <ModelSelect
                    value={selectedModel?.id}
                    models={models}
                    isLoading={isModelsLoading}
                    onChange={handleSelectModel}
                  />
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {!!selectedModel && (
                    <TokenUsage
                      contextWindow={selectedModel.contextWindow}
                      totalTokens={totalTokens}
                      className="mr-5"
                    />
                  )}
                  <DevModeButton
                    messages={messages}
                    buildEnvironment={buildEnvironment}
                    todos={todos}
                    taskId={taskId.current}
                  />
                  {taskId.current && uid.current && (
                    <PublicShareButton
                      isPublicShared={loaderData?.isPublicShared === true}
                      disabled={isTaskLoading || isModelsLoading}
                      taskId={taskId.current}
                      uid={uid.current}
                      onError={setAutoDismissError}
                    />
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-6 w-6 rounded-md p-0"
                  >
                    <ImageIcon className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={isSubmitDisabled}
                    className="h-6 w-6 rounded-md p-0 transition-opacity"
                    onClick={() => {
                      if (isLoading || isUploadingImages) {
                        handleStop();
                      } else {
                        formRef.current?.requestSubmit();
                      }
                    }}
                  >
                    {isLoading || isUploadingImages ? (
                      <StopCircleIcon className="size-4" />
                    ) : (
                      <SendHorizonal className="size-4" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </ChatEventProvider>
  );
}

function useNewTaskHandler({
  data,
  taskId,
  uid,
}: {
  data: unknown[] | undefined;
  taskId: React.MutableRefObject<number | undefined>;
  uid: React.MutableRefObject<string | undefined>;
}) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!data || data.length === 0) return;

    const dataParts = data as DataPart[];
    for (const part of dataParts) {
      if (taskId.current === undefined && part.type === "append-id") {
        vscodeHost.capture({
          event: "newTask",
        });
        taskId.current = part.id;
        uid.current = part.uid;

        queryClient.invalidateQueries({ queryKey: ["tasks"] });

        vscodeHost.setSessionState({
          lastVisitedRoute: `/?taskId=${taskId.current}`,
        });
      }
    }
  }, [data, queryClient, taskId, uid]);
}

function useTokenUsageUpdater({
  data,
  setTotalTokens,
}: {
  data: unknown[] | undefined;
  setTotalTokens: React.Dispatch<React.SetStateAction<number>>;
}) {
  useEffect(() => {
    if (!data || data.length === 0) return;

    const dataParts = data as DataPart[];
    for (const part of dataParts) {
      if (part.type === "update-usage") {
        setTotalTokens(part.totalTokens);
      }
    }
  }, [data, setTotalTokens]);
}

function prepareRequestBody(
  taskId: MutableRefObject<number | undefined>,
  request: {
    messages: UIMessage[];
  },
  model: string | undefined,
): Omit<RagdollChatRequest, "environment"> {
  const message = request.messages[request.messages.length - 1];
  const triggerError =
    message.parts[0].type === "text" &&
    message.parts[0].text.includes("RAGDOLL_DEBUG_TRIGGER_ERROR");
  return {
    id: taskId.current?.toString(),
    model: triggerError ? "fake-model" : (model ?? DefaultModelId),
    message: fromUIMessage(message),
  };
}

interface UseEventAutoStartOptions {
  task: Task | null;
  retry: (error: Error) => void;
  enabled: boolean;
}

const usePendingModelAutoStart = ({
  task,
  retry,
  enabled,
}: UseEventAutoStartOptions) => {
  const init = task?.status === "pending-model";

  const initStarted = useRef(false);
  useEffect(() => {
    if (enabled && init && !initStarted.current) {
      initStarted.current = true;
      retry(new ReadyForRetryError("ready"));
    }
  }, [init, retry, enabled]);
};

interface UseScrollToBottomProps {
  messagesContainerRef: React.RefObject<HTMLDivElement>;
  isLoading: boolean;
  hasPendingApproval: boolean;
}

function useScrollToBottom({
  messagesContainerRef,
  isLoading,
  hasPendingApproval,
}: UseScrollToBottomProps) {
  const { isAtBottom, scrollToBottom } = useIsAtBottom(messagesContainerRef);

  // Scroll to bottom when the message list height changes
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container?.children[0]) {
      return;
    }
    const resizeObserver = new ResizeObserver(() => {
      if (isAtBottom) {
        requestAnimationFrame(() => scrollToBottom());
      }
    });
    resizeObserver.observe(container.children[0]);
    return () => {
      resizeObserver.disconnect();
    }; // clean up
  }, [isAtBottom, scrollToBottom, messagesContainerRef]);

  // scroll to bottom immediately when a user message is sent
  useLayoutEffect(() => {
    if (isLoading) {
      scrollToBottom();
    }
  }, [isLoading, scrollToBottom]);

  // Initial scroll to bottom once when component mounts (without smooth behavior)
  useLayoutEffect(() => {
    if (messagesContainerRef.current) {
      scrollToBottom(false); // false = not smooth
    }
  }, [scrollToBottom, messagesContainerRef]);

  // Ensure users can always see the executing approval or the pause approval that require their input
  useLayoutEffect(() => {
    if (!isLoading && hasPendingApproval) {
      scrollToBottom(false);
    }
  }, [hasPendingApproval, isLoading, scrollToBottom]);
}
