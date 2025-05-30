import { ModelSelect } from "@/components/model-select";
import { FormEditor } from "@/components/prompt-form/form-editor";
import { Button } from "@/components/ui/button";
import {
  ReadyForRetryError,
  useReadyForRetryError,
} from "@/features/approval/hooks/use-ready-for-retry-error";
import { useRetry } from "@/features/approval/hooks/use-retry";
import { apiClient } from "@/lib/auth-client";
import { useIsAtBottom } from "@/lib/hooks/use-is-at-bottom";
import { useSelectedModels } from "@/lib/hooks/use-models";
import {
  ChatStateProvider,
  useAutoApproveGuard,
} from "@/lib/stores/chat-state";
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
  Bug,
  ImageIcon,
  Loader2,
  Plus,
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
  useReducer,
  useRef,
  useState,
} from "react";
import { z } from "zod";

import { DevModeButton } from "@/components/dev-mode-button"; // Added import
import { EmptyChatPlaceholder } from "@/components/empty-chat-placeholder";
import { ErrorMessage } from "@/components/error-message";
import { ImagePreviewList } from "@/components/image-preview-list";
import { useUploadImage } from "@/components/image-preview-list/use-upload-image";
import { MessageList } from "@/components/message/message-list";
import { PreviewTool } from "@/components/preview-tool";
import "@/components/prompt-form/prompt-form.css";
import { AutoApproveMenu } from "@/components/settings/auto-approve-menu";
import { TokenUsage } from "@/components/token-usage";
import { FileBadge } from "@/components/tool-invocation/file-badge";
import { WorkspaceRequiredPlaceholder } from "@/components/workspace-required-placeholder";
import {
  ApprovalButton,
  getDisplayError,
  pendingApprovalKey,
} from "@/features/approval";
import { usePendingApproval } from "@/features/approval/hooks/use-pending-approval";
import { TodoList, useTodos } from "@/features/todo";
import { DefaultModelId, MaxImages } from "@/lib/constants";
import { useActiveSelection } from "@/lib/hooks/use-active-selection";
import { useAutoResume } from "@/lib/hooks/use-auto-resume";
import { useCurrentWorkspace } from "@/lib/hooks/use-current-workspace";
import { useIsDevMode } from "@/lib/hooks/use-is-dev-mode";
import { useLatest } from "@/lib/hooks/use-latest";
import { useMcp } from "@/lib/hooks/use-mcp";
import { useResourceURI } from "@/lib/hooks/use-resource-uri";
import { useSettingsStore } from "@/lib/stores/settings-store";
import { cn } from "@/lib/utils";
import {
  createImageFileName,
  isDuplicateFile,
  processImageFiles,
  validateImages,
} from "@/lib/utils/image";
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
    <ChatStateProvider>
      <Chat
        key={key}
        loaderData={loaderData || null}
        isTaskLoading={isTaskLoading}
      />
    </ChatStateProvider>
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
  const [isDevMode] = useIsDevMode();
  const autoApproveGuard = useAutoApproveGuard();
  const taskId = useRef<number | undefined>(loaderData?.id);
  const [totalTokens, setTotalTokens] = useState<number>(
    loaderData?.totalTokens || 0,
  );

  const isBatchEvaluationTask = loaderData?.event?.type === "batch:evaluation";

  useEffect(() => {
    taskId.current = loaderData?.id;
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
  } = useSelectedModels();
  const initialMessages = toUIMessages(
    loaderData?.conversation?.messages || [],
  );

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  // Error specific to image selection that will auto-dismiss after a few seconds
  const [imageSelectionError, setImageSelectionError] = useState<
    Error | undefined
  >(undefined);

  // Auto-dismiss error after 5 seconds
  useEffect(() => {
    if (imageSelectionError) {
      const timer = setTimeout(() => {
        setImageSelectionError(undefined);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [imageSelectionError]);

  const handleRemoveImage = (index: number) => {
    setFiles((prev) => {
      const newFiles = [...prev];
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const showImageError = (message: string) => {
    setImageSelectionError(new Error(message));
  };

  const validateAndAddImages = (
    newImages: File[],
    fromClipboard = false,
  ): { success: boolean; error?: string } => {
    const result = validateImages(
      files,
      processImageFiles(newImages, fromClipboard),
      MaxImages,
    );

    if (result.success) {
      setFiles((prevFiles) => [...prevFiles, ...result.validatedImages]);
      setImageSelectionError(undefined);
    }

    return {
      success: result.success,
      error: result.error,
    };
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const selectedFiles = Array.from(event.target.files);

      // Deduplication check for device uploads
      const nonDuplicateFiles = selectedFiles.filter(
        (file) => !isDuplicateFile(file, files),
      );

      // Show message if any duplicates were found
      if (nonDuplicateFiles.length < selectedFiles.length) {
        showImageError(
          `${selectedFiles.length - nonDuplicateFiles.length} duplicate image(s) were skipped.`,
        );
        // If all files were duplicates, stop here
        if (nonDuplicateFiles.length === 0) {
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
          return;
        }
      }

      const result = validateAndAddImages(nonDuplicateFiles);

      if (!result.success) {
        showImageError(result.error || "Error adding images");
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

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
    error: chatError,
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
    experimental_throttle: 100,
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
            reasoning: enableReasoningRef.current
              ? { enabled: true }
              : undefined,
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

  const readyForRetryError = useReadyForRetryError(messages);
  const error = chatError || readyForRetryError;

  const { todos } = useTodos({
    initialTodos: loaderData?.todos,
    messages,
    todosRef,
  });

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

  useEffect(() => {
    const handler = setTimeout(() => {
      vscodeHost.setSessionState({
        input: input,
      });
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [input]);

  useEffect(() => {
    const fetchSessionState = async () => {
      const sessionState = await vscodeHost.getSessionState(["input"]);
      if (sessionState.input) {
        setInput(sessionState.input);
      }
    };
    fetchSessionState();
  }, [setInput]);

  const {
    uploadImages,
    uploadingFilesMap,
    isUploadingImages,
    stop: stopUpload,
    error: uploadImageError,
    clearError: clearUploadImageError,
  } = useUploadImage({
    token: authData.session.token,
    files,
  });

  const wrappedHandleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitDisabled) return;

    if (files.length > 0) {
      const uploadedImages: Attachment[] = await uploadImages();

      append({
        role: "user",
        content: !input.trim() ? " " : input, // use space to keep parts not empty
        experimental_attachments: uploadedImages,
      });

      setInput("");
      setFiles([]);
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
      stopUpload();
    } else if (isLoading) {
      stopChat();
    } else if (pendingApproval?.name === "retry") {
      pendingApproval.stopCountdown();
    }
  };

  const updateSelectedModelId = useSettingsStore(
    (x) => x.updateSelectedModelId,
  );
  const enableReasoning = useSettingsStore((x) => x.enableReasoning);
  const enableReasoningRef = useLatest(enableReasoning);

  const handleSelectModel = (v: string) => {
    updateSelectedModelId(v);
  };

  const handlePasteImage = (event: ClipboardEvent) => {
    const images = Array.from(event.clipboardData?.items || [])
      .filter((item) => item.type.startsWith("image/"))
      .map((item) => {
        const file = item.getAsFile();
        if (file) {
          return new File([file], createImageFileName(file.type), {
            type: file.type,
          });
        }
        return null;
      })
      .filter(Boolean) as File[];

    if (images.length > 0) {
      // Use fromClipboard=true to indicate these are clipboard images
      const result = validateAndAddImages(images, true);

      if (!result.success) {
        showImageError(result.error || "Error adding images");
        event.preventDefault();
        return true;
      }

      event.preventDefault();
      return true;
    }

    return false;
  };

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

        queryClient.invalidateQueries({ queryKey: ["tasks"] });

        vscodeHost.setSessionState({
          lastVisitedRoute: `/?taskId=${taskId.current}`,
        });
      } else if (part.type === "update-usage") {
        setTotalTokens(part.totalTokens);
      }
    }
  }, [data, queryClient]);

  const isLoading = status === "streaming" || status === "submitted";
  const isSubmitDisabled =
    isTaskLoading ||
    isModelsLoading ||
    (!isLoading && !input && files.length === 0);

  const editorRef = useRef<Editor | null>(null);

  const renderMessages = useMemo(() => formatters.ui(messages), [messages]);

  const {
    pendingApproval,
    setIsExecuting,
    executingToolCallId,
    increaseRetryCount,
  } = usePendingApproval({
    error,
    messages: renderMessages,
    status,
  });

  const activeSelection = useActiveSelection();

  const retryImpl = useRetry({
    error,
    messages,
    append,
    setMessages,
    reload,
    experimental_resume,
    latestHttpCode,
  });

  const retry = useCallback(() => {
    increaseRetryCount();
    retryImpl();
  }, [retryImpl, increaseRetryCount]);

  useEventAutoStart({
    enabled: error instanceof ReadyForRetryError,
    task: loaderData,
    retry,
  });

  /*
  Workaround for https://github.com/vercel/ai/issues/4491#issuecomment-2848999826
  Reproduce steps:
  1. Use a model that supports parallel tool calls (e.g., gpt-4o-mini).
  2. Ask the model to write two files, fib.rs and fib.py, concurrently.
  3. Reject the first call and accept the second call.
  Without forceUpdate, the first rejection will not be reflected in the UI.
  */
  const [, forceUpdate] = useReducer((x) => x + 1, 0);
  const addToolResultWithForceUpdate: typeof addToolResult = useCallback(
    (arg) => {
      addToolResult(arg);
      forceUpdate();
    },
    [addToolResult],
  );

  const { isAtBottom, scrollToBottom } = useIsAtBottom(messagesContainerRef);

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
  }, [scrollToBottom]);

  // Handle scrolling during streaming if at bottom
  useLayoutEffect(() => {
    if (!messages.length || !isLoading || !isAtBottom) return;

    const frameId = requestAnimationFrame(() => scrollToBottom(false)); // Using false to disable smooth scrolling during streaming
    return () => cancelAnimationFrame(frameId);
  }, [isLoading, isAtBottom, messages, scrollToBottom]);

  // Ensure users can always see the executing approval or the pause approval that require their input
  useLayoutEffect(() => {
    if (!isLoading && !!pendingApproval?.name) {
      scrollToBottom(false);
    }
  }, [pendingApproval?.name, isLoading, scrollToBottom]);

  const resourceUri = useResourceURI();

  // Display errors with priority: 1. imageSelectionError, 2. uploadImageError, 3. error pending retry approval
  const displayError =
    imageSelectionError || uploadImageError || getDisplayError(pendingApproval);
  return (
    <div className="flex h-screen flex-col">
      <PreviewTool messages={renderMessages} addToolResult={addToolResult} />

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
        sendMessage={append}
        isLoading={isLoading || isTaskLoading}
        executingToolCallId={executingToolCallId}
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
            {todos && todos.length > 0 && (
              <TodoList todos={todos} status={status} />
            )}
            <ApprovalButton
              key={pendingApprovalKey(pendingApproval)}
              isLoading={isLoading || isTaskLoading}
              pendingApproval={pendingApproval}
              retry={retry}
              addToolResult={addToolResultWithForceUpdate}
              executingToolCallId={executingToolCallId}
              setIsExecuting={setIsExecuting}
            />
            <AutoApproveMenu />
            {files.length > 0 && (
              <ImagePreviewList
                files={files}
                onRemove={handleRemoveImage}
                uploadingFiles={uploadingFilesMap}
              />
            )}
            <FormEditor
              input={input}
              setInput={setInput}
              onSubmit={wrappedHandleSubmit}
              isLoading={isLoading}
              formRef={formRef}
              editorRef={editorRef}
              onPaste={handlePasteImage}
            >
              <div className="mt-1 select-none pl-2">
                <div
                  className={cn(
                    "inline-flex h-[1.7rem] max-w-full items-center gap-1 overflow-hidden truncate rounded-sm border border-[var(--vscode-chat-requestBorder)]",
                    {
                      "border-dashed": !activeSelection,
                    },
                  )}
                >
                  {activeSelection ? (
                    <FileBadge
                      className="hover:!bg-transparent !py-0 m-0 cursor-default truncate rounded-sm border-none pr-1"
                      labelClassName="whitespace-nowrap"
                      label={activeSelection.filepath.split("/").pop()}
                      path={activeSelection.filepath}
                      startLine={
                        activeSelection.content.length > 0
                          ? activeSelection.range.start.line
                          : undefined
                      }
                      endLine={
                        activeSelection.content.length > 0
                          ? activeSelection.range.end.line
                          : undefined
                      }
                      onClick={() => {
                        editorRef.current?.commands.focus();
                      }}
                    />
                  ) : (
                    <p
                      className="flex items-center gap-1 px-2 text-muted-foreground text-sm"
                      onClick={() =>
                        editorRef.current?.commands.insertContent(" @")
                      }
                    >
                      <Plus className="size-3" />
                      Add Context
                    </p>
                  )}
                </div>
                {isDevMode && (
                  <span className="absolute top-1 right-2 text-foreground/80 text-xs">
                    <span className="flex items-center gap-1">
                      <Bug className="inline size-3" />
                      <span>{status}</span>
                      {pendingApproval?.name === "retry" ? (
                        <div>
                          <span>Attempts: {pendingApproval.attempts}</span> /{" "}
                          <span>Countdown: {pendingApproval.countdown}</span> /{" "}
                          <span>Delay: {pendingApproval.delay}</span>
                        </div>
                      ) : undefined}
                    </span>
                  </span>
                )}
              </div>
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
                {isDevMode && (
                  <DevModeButton
                    messages={messages}
                    buildEnvironment={buildEnvironment}
                    todos={todos}
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
  );
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
  retry: () => void;
  enabled: boolean;
}

const useEventAutoStart = ({
  task,
  retry,
  enabled,
}: UseEventAutoStartOptions) => {
  const messages = task?.conversation?.messages || [];
  const init =
    messages.length === 1 &&
    messages[0].role === "user" &&
    task?.status === "pending-input";

  const initStarted = useRef(false);
  useEffect(() => {
    if (
      enabled &&
      init &&
      !initStarted.current &&
      task.event?.type === "website:new-project"
    ) {
      initStarted.current = true;
      retry();
    }
  }, [init, retry, task, enabled]);
};
