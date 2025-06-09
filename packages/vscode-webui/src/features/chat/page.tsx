import { ModelSelect } from "@/components/model-select";
import { Button } from "@/components/ui/button";
import {
  ChatContextProvider,
  useAutoApproveGuard,
  useToolCallLifeCycle,
} from "@/features/chat";
import { useEnableReasoning, useSelectedModels } from "@/features/settings";
import { apiClient, type authClient } from "@/lib/auth-client";
import { useChat } from "@ai-sdk/react";
import type { Environment, Todo } from "@ragdoll/common";
import { formatters, fromUIMessages, toUIMessages } from "@ragdoll/common";
import type { Attachment, UIMessage } from "ai";
import type { InferResponseType } from "hono/client";
import {
  ImageIcon,
  Loader2,
  SendHorizonal,
  StopCircleIcon,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DevModeButton } from "@/components/dev-mode-button"; // Added import
import { EmptyChatPlaceholder } from "@/components/empty-chat-placeholder";
import { ErrorMessage } from "@/components/error-message";
import { ImagePreviewList } from "@/components/image-preview-list";
import { MessageList } from "@/components/message/message-list";
import { PreviewTool } from "@/components/preview-tool";
import { PublicShareButton } from "@/components/public-share-button";
import "@/components/prompt-form/prompt-form.css";
import { TokenUsage } from "@/components/token-usage";
import { WorkspaceRequiredPlaceholder } from "@/components/workspace-required-placeholder";
import { ApprovalButton, useApprovalAndRetry } from "@/features/approval";
import { AutoApproveMenu } from "@/features/settings";
import { LegacyTodoList, useTodos } from "@/features/todo";
import { useAddCompleteToolCalls } from "@/lib/hooks/use-add-complete-tool-calls";
import { useAutoResume } from "@/lib/hooks/use-auto-resume";
import { useCurrentWorkspace } from "@/lib/hooks/use-current-workspace";
import { useImageUpload } from "@/lib/hooks/use-image-upload";
import { useMcp } from "@/lib/hooks/use-mcp";
import { useResourceURI } from "@/lib/hooks/use-resource-uri";
import { vscodeHost } from "@/lib/vscode";
import { useAutoDismissError } from "./hooks/use-auto-dismiss-error";

import { hasAttemptCompletion } from "@ragdoll/common/message-utils";
import { ChatInputForm } from "./components/chat-input-form";
import { useNewTaskHandler } from "./hooks/use-new-task-handler";
import { usePendingModelAutoStart } from "./hooks/use-pending-model-auto-start";
import { useScrollToBottom } from "./hooks/use-scroll-to-bottom";
import { useTokenUsageUpdater } from "./hooks/use-token-usage-updater";
import { useHandleChatEvents } from "./lib/chat-events";
import { prepareRequestBody } from "./lib/prepare-request-body";

export function ChatPage({
  task,
  isTaskLoading,
  auth,
}: {
  task: Task | null;
  isTaskLoading: boolean;
  auth: typeof authClient.$Infer.Session;
}) {
  return (
    <ChatContextProvider>
      <Chat task={task} isTaskLoading={isTaskLoading} auth={auth} />
    </ChatContextProvider>
  );
}

type Task = NonNullable<
  InferResponseType<(typeof apiClient.api.tasks)[":id"]["$get"]>
>;

interface ChatProps {
  task: Task | null;
  isTaskLoading: boolean;
  auth: typeof authClient.$Infer.Session;
}

function Chat({ auth, task, isTaskLoading }: ChatProps) {
  const autoApproveGuard = useAutoApproveGuard();
  const taskId = useRef<number | undefined>(task?.id);
  const uid = useRef<string | undefined>(task?.uid);
  const [totalTokens, setTotalTokens] = useState<number>(
    task?.totalTokens || 0,
  );

  const isBatchEvaluationTask = task?.event?.type === "batch:evaluation";

  useEffect(() => {
    taskId.current = task?.id;
    uid.current = task?.uid;
    if (task) {
      setTotalTokens(task.totalTokens || 0);
    }
  }, [task]);

  useEffect(() => {
    if (isBatchEvaluationTask) {
      autoApproveGuard.current = true;
    }
  }, [isBatchEvaluationTask, autoApproveGuard]);

  const { data: currentWorkspace, isFetching } = useCurrentWorkspace();
  const isWorkspaceActive = !!currentWorkspace;

  const {
    models,
    selectedModel,
    isLoading: isModelsLoading,
    updateSelectedModelId: handleSelectModel,
  } = useSelectedModels();
  const initialMessages = toUIMessages(task?.conversation?.messages || []);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const { error: autoDismissError, setError: setAutoDismissError } =
    useAutoDismissError();

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
    token: auth.session.token,
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
    onFinish: (message, { finishReason }) => {
      autoApproveGuard.current = true;
      vscodeHost.capture({
        event: "chatFinish",
        properties: {
          modelId: selectedModel?.id,
          finishReason,
        },
      });

      if (
        isBatchEvaluationTask &&
        finishReason === "tool-calls" &&
        message.parts &&
        hasAttemptCompletion(message as UIMessage)
      ) {
        vscodeHost.closeCurrentWorkspace();
      }
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
      Authorization: `Bearer ${auth.session.token}`,
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
    initialTodos: task?.todos,
    messages,
    todosRef,
    append,
  });

  useAutoResume({
    autoResume:
      !isTaskLoading &&
      task?.status === "streaming" &&
      initialMessages.length > 0 &&
      initialMessages.length === messages.length,
    initialMessages,
    experimental_resume,
    setMessages,
    data,
  });

  // This function handles both form submissions (with an event) and programmatic invocations (without an event).
  const wrappedHandleSubmit = async (e?: React.FormEvent<HTMLFormElement>) => {
    autoApproveGuard.current = true;
    e?.preventDefault();

    if (isSubmitDisabled) {
      return;
    }

    await handleStop();

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

  const handleStop = async () => {
    if (isExecuting) {
      abortToolCalls();
    } else if (isUploadingImages) {
      cancelUpload();
    } else if (isLoading) {
      stopChat();
      if (taskId.current) {
        const lastMessage = messages.at(-1);
        if (lastMessage) {
          await apiClient.api.tasks[":id"].messages.$patch({
            param: {
              id: taskId.current.toString(),
            },
            json: {
              messages: fromUIMessages([lastMessage]),
            },
          });
        }
      }
    } else if (pendingApproval?.name === "retry") {
      pendingApproval.stopCountdown();
    }
  };

  const enableReasoning = useEnableReasoning();

  useNewTaskHandler({ data, taskId, uid });

  useTokenUsageUpdater({
    data,
    setTotalTokens,
  });

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
    task: task,
    retry,
  });

  const { executingToolCalls } = useToolCallLifeCycle();
  const abortToolCalls = useCallback(() => {
    for (const toolCall of executingToolCalls) {
      toolCall.abort();
    }
  }, [executingToolCalls]);
  const isExecuting = executingToolCalls.length > 0;
  const isLoading = status === "streaming" || status === "submitted";

  const isBusyCore = isTaskLoading || isModelsLoading;
  const isBusy = isBusyCore || isExecuting || isLoading;
  const showEditTodos = !isBusy;

  const isSubmitDisabled =
    isBusyCore ||
    isEditMode ||
    (!isLoading && !input && files.length === 0 && !isExecuting);
  const showStopButton = isExecuting || isLoading || isUploadingImages;

  useScrollToBottom({
    messagesContainerRef,
    isLoading,
    pendingApprovalName: pendingApproval?.name,
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

  useHandleChatEvents(isLoading ? append : undefined);

  return (
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
        user={auth.user}
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
                saveTodos={saveTodos}
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
            <ChatInputForm
              input={input}
              setInput={setInput}
              onSubmit={wrappedHandleSubmit}
              isLoading={isLoading || isExecuting}
              onPaste={handlePasteImage}
              pendingApproval={pendingApproval}
              status={status}
            />

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
                    isPublicShared={task?.isPublicShared === true}
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
                    if (showStopButton) {
                      handleStop();
                    } else {
                      wrappedHandleSubmit();
                    }
                  }}
                >
                  {showStopButton ? (
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
