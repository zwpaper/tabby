import { ModelSelect } from "@/components/model-select";
import { Button } from "@/components/ui/button";
import { ChatContextProvider, useAutoApproveGuard } from "@/features/chat";
import { useSelectedModels } from "@/features/settings";
import { apiClient, type authClient } from "@/lib/auth-client";
import { type UseChatHelpers, useChat } from "@ai-sdk/react";
import { formatters, toUIMessages } from "@ragdoll/common";
import type { Environment, Todo } from "@ragdoll/db";
import type { UIMessage } from "ai";
import type { InferResponseType } from "hono/client";
import { ImageIcon, SendHorizonal, StopCircleIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DevModeButton } from "@/components/dev-mode-button"; // Added import
import { ErrorMessage } from "@/components/error-message";
import { ImagePreviewList } from "@/components/image-preview-list";
import { PreviewTool } from "@/components/preview-tool";
import { PublicShareButton } from "@/components/public-share-button";
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
import { vscodeHost } from "@/lib/vscode";
import { useAutoDismissError } from "./hooks/use-auto-dismiss-error";

import { hasAttemptCompletion } from "@ragdoll/common/message-utils";
import { useSettingsStore } from "../settings/store";
import { ChatArea } from "./components/chat-area";
import { ChatInputForm } from "./components/chat-input-form";
import { useChatStatus } from "./hooks/use-chat-status";
import { useChatSubmit } from "./hooks/use-chat-submit";
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
  InferResponseType<(typeof apiClient.api.tasks)[":uid"]["$get"]>
>;
interface ChatProps {
  task: Task | null;
  isTaskLoading: boolean;
  auth: typeof authClient.$Infer.Session;
}

function Chat({ auth, task, isTaskLoading }: ChatProps) {
  const autoApproveGuard = useAutoApproveGuard();
  const uid = useRef<string | undefined>(task?.uid);
  const [totalTokens, setTotalTokens] = useState<number>(
    task?.totalTokens || 0,
  );

  const isBatchEvaluationTask = task?.event?.type === "batch:evaluation";

  useEffect(() => {
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
  const imageUpload = useImageUpload({
    token: auth.session.token,
  });
  const {
    files,
    isUploading: isUploadingImages,
    error: uploadImageError,
    fileInputRef,
    removeFile: handleRemoveImage,
    handleFileSelect,
    handlePaste: handlePasteImage,
  } = imageUpload;

  const todosRef = useRef<Todo[] | undefined>(undefined);
  const buildEnvironment = useCallback(async () => {
    return {
      todos: todosRef.current,
      ...(await vscodeHost.readEnvironment()),
    } satisfies Environment;
  }, []);

  const { toolset: mcpToolSet } = useMcp();
  const { enableNewTask } = useSettingsStore();

  const latestHttpCode = useRef<number | undefined>(undefined);
  const chat = useChat({
    /*
     * DO NOT SET throttle - it'll cause messages got re-written after the chat became ready state.
     */
    // experimental_throttle: 100,
    initialMessages,
    api: apiClient.api.chat.stream.$url().toString(),
    onFinish: (message, { finishReason }) => {
      autoApproveGuard.current = true;
      let numToolCalls: number | undefined;
      if (finishReason === "tool-calls") {
        // Find the last step-start index
        const lastStepStartIndex =
          message.parts?.reduce((lastIndex, part, index) => {
            return part.type === "step-start" ? index : lastIndex;
          }, -1) ?? -1;

        // Count tool invocations only from after the last step-start
        numToolCalls =
          message.parts
            ?.slice(lastStepStartIndex + 1)
            .filter((part) => part.type === "tool-invocation").length || 0;
      }

      vscodeHost.capture({
        event: "chatFinish",
        properties: {
          modelId: selectedModel?.id,
          finishReason,
          numToolCalls,
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
      prepareRequestBody(uid, req, selectedModel?.id),
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
            // Inject the mcp tool set into the request body
            mcpToolSet,
            enableNewTask,
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
    addToolResult,
    experimental_resume,
  } = chat;

  const {
    todos,
    isEditMode,
    draftTodos,
    hasDirtyChanges,
    enterEditMode,
    exitEditMode,
    saveTodos: saveTodosImpl,
    updateTodoStatus,
  } = useTodos({
    initialTodos: task?.todos,
    messages,
    todosRef,
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

  useNewTaskHandler({ data, uid });

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
    enabled: status === "ready" && messages.length === 1 && !isTaskLoading,
    task: task,
    retry,
  });

  const isLoading = status === "streaming" || status === "submitted";

  const { isExecuting, isSubmitDisabled, showStopButton, showEditTodos } =
    useChatStatus({
      isTaskLoading,
      isModelsLoading,
      isLoading,
      isInputEmpty: !input.trim(),
      isFilesEmpty: files.length === 0,
      isUploadingImages,
    });

  const { handleSubmit, handleStop } = useChatSubmit({
    chat,
    imageUpload,
    isSubmitDisabled,
    isLoading,
    uid,
    pendingApproval,
  });

  const saveTodos = useCallback(() => {
    saveTodosImpl();
    handleSubmit(
      undefined,
      "<user-reminder>I have updated the to-do list and provided it within environment details. Please review them and adjust the plan accordingly. NEVER WORK ON TASKS THAT HAS BEEN MARKED AS COMPLETED OR CANCELLED.</user-reminder>",
    );
  }, [saveTodosImpl, handleSubmit]);

  useScrollToBottom({
    messagesContainerRef,
    isLoading,
    pendingApprovalName: pendingApproval?.name,
  });

  // Display errors with priority: 1. autoDismissError, 2. uploadImageError, 3. error pending retry approval
  const taskError = useTaskError(status, task);
  const displayError =
    autoDismissError ||
    uploadImageError ||
    taskError ||
    (pendingApproval?.name === "retry" ? pendingApproval.error : undefined);

  // Only allow adding tool results when not loading
  const allowAddToolResult = !(isLoading || isTaskLoading || isEditMode);

  useAddCompleteToolCalls({
    messages,
    addToolResult: allowAddToolResult ? addToolResult : undefined,
  });

  useHandleChatEvents(isLoading ? undefined : append);

  return (
    <div className="flex h-screen flex-col">
      <PreviewTool
        messages={renderMessages}
        // Only allow adding tool results when not loading
      />
      <ChatArea
        messages={renderMessages}
        isTaskLoading={isTaskLoading}
        isLoading={isLoading}
        user={auth.user}
        messagesContainerRef={messagesContainerRef}
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
            <ApprovalButton
              pendingApproval={pendingApproval}
              retry={retry}
              allowAddToolResult={allowAddToolResult}
            />
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
              onSubmit={handleSubmit}
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
                  uid={uid.current}
                />
                {uid.current && (
                  <PublicShareButton
                    isPublicShared={task?.isPublicShared === true}
                    disabled={isTaskLoading || isModelsLoading}
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
                      autoApproveGuard.current = false;
                      handleStop();
                    } else {
                      handleSubmit();
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

class TaskError extends Error {
  constructor(
    readonly name: string,
    message: string,
  ) {
    super(message);
  }
}

function useTaskError(status: UseChatHelpers["status"], task?: Task | null) {
  const init = useRef(false);
  const [taskError, setTaskError] = useState<TaskError>();
  useEffect(() => {
    if (init.current || !task) return;
    init.current = true;
    const { error } = task;
    if (error) {
      setTaskError(new TaskError(error.kind, error.message));
    }
  }, [task]);

  useEffect(() => {
    if (init.current && !taskError) return;
    if (status === "submitted" || status === "streaming") {
      setTaskError(undefined);
    }
  }, [status, taskError]);
  return taskError;
}
