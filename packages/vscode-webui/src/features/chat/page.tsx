import { ImagePreviewList } from "@/components/image-preview-list";
import { ModelSelect } from "@/components/model-select";
import { PreviewTool } from "@/components/preview-tool";
import { Button } from "@/components/ui/button";
import { WorkspaceRequiredPlaceholder } from "@/components/workspace-required-placeholder";
import {
  ChatContextProvider,
  useAutoApproveGuard,
  useHandleChatEvents,
} from "@/features/chat";
import { useSelectedModels } from "@/features/settings";
import { AutoApproveMenu } from "@/features/settings";
import type { User } from "@/lib/auth-client";
import { useCurrentWorkspace } from "@/lib/hooks/use-current-workspace";
import { useImageUpload } from "@/lib/hooks/use-image-upload";
import { type UseChatHelpers, useChat } from "@ai-sdk/react";
import type { Todo } from "@getpochi/tools";
import { ImageIcon, SendHorizonal, StopCircleIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DevModeButton } from "@/components/dev-mode-button";
import { PublicShareButton } from "@/components/public-share-button";
import { TokenUsage } from "@/components/token-usage";
import { usePendingModelAutoStart } from "@/features/retry";
import { useAddCompleteToolCalls } from "@/lib/hooks/use-add-complete-tool-calls";
import { vscodeHost } from "@/lib/vscode";
import type { Environment } from "@getpochi/common";
import { constants, formatters } from "@getpochi/common";
import type { UserEditsDiff } from "@getpochi/common/vscode-webui-bridge";
import { type Message, type Task, catalog } from "@getpochi/livekit";
import { useLiveChatKit } from "@getpochi/livekit/react";
import { useStore } from "@livestore/react";
import { useRouter } from "@tanstack/react-router";
import { lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { ApprovalButton, useApprovalAndRetry } from "../approval";
import { TodoList, useTodos } from "../todo";
import { ChatArea } from "./components/chat-area";
import { ChatInputForm } from "./components/chat-input-form";
import { ErrorMessageView } from "./components/error-message-view";
import { useAutoDismissError } from "./hooks/use-auto-dismiss-error";
import { useChatStatus } from "./hooks/use-chat-status";
import { useChatSubmit } from "./hooks/use-chat-submit";
import { useInlineCompactTask } from "./hooks/use-inline-compact-task";
import { useNewCompactTask } from "./hooks/use-new-compact-task";
import { useScrollToBottom } from "./hooks/use-scroll-to-bottom";
import { useLiveChatKitGetters } from "./lib/use-live-chat-kit-getters";

export function ChatPage({
  uid,
  user,
  prompt,
}: { uid: string; user?: User; prompt?: string }) {
  return (
    <ChatContextProvider>
      <Chat user={user} uid={uid} prompt={prompt} />
    </ChatContextProvider>
  );
}

interface ChatProps {
  uid: string;
  user?: User;
  prompt?: string;
}

function Chat({ user, uid, prompt }: ChatProps) {
  const { store } = useStore();
  const todosRef = useRef<Todo[] | undefined>(undefined);
  const getters = useLiveChatKitGetters({
    todos: todosRef,
  });

  const defaultUser = {
    name: "You",
    image: `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(store.clientId)}&scale=120`,
  };

  const chatKit = useLiveChatKit({
    taskId: uid,
    getters,
    allowNewTask: true,
    sendAutomaticallyWhen: (x) => {
      // AI SDK v5 will retry regardless of the status if sendAutomaticallyWhen is set.
      if (chatKit.chat.status === "error") {
        return false;
      }
      return lastAssistantMessageIsCompleteWithToolCalls(x);
    },
    onBeforeMakeRequest: async ({ messages }) => {
      const lastMessage = messages.at(-1);
      if (lastMessage) {
        await appendCheckpoint(lastMessage);
      }
    },
  });
  const task = store.useQuery(catalog.queries.makeTaskQuery(uid));
  const totalTokens = task?.totalTokens || 0;
  const isTaskLoading = false;

  const autoApproveGuard = useAutoApproveGuard();
  // const { data: minionId } = useMinionId();
  // const { uid, uidRef, setUid } = useUid(task);
  // const [totalTokens, setTotalTokens] = useState<number>(
  //   task?.totalTokens || 0,
  // );
  // useEffect(() => {
  //   if (task) {
  //     setTotalTokens(task.totalTokens || 0);
  //   }
  // }, [task]);

  const { data: currentWorkspace, isFetching } = useCurrentWorkspace();
  const isWorkspaceActive = !!currentWorkspace;

  const {
    groupedModels,
    selectedModel,
    isLoading: isModelsLoading,
    updateSelectedModelId: handleSelectModel,
  } = useSelectedModels();

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const { error: autoDismissError /* setError: setAutoDismissError */ } =
    useAutoDismissError();

  // Use the unified image upload hook
  const imageUpload = useImageUpload();
  const {
    files,
    isUploading: isUploadingImages,
    error: uploadImageError,
    fileInputRef,
    removeFile: handleRemoveImage,
    handleFileSelect,
    handlePaste: handlePasteImage,
  } = imageUpload;

  // const latestHttpCode = useRef<number | undefined>(undefined);
  // const recentAborted = useRef<boolean>(false);
  const chat = useChat({
    chat: chatKit.chat,
  });
  useStopBeforeNavigate(chat);
  // const chat = useChat({
  //   /*
  //    * DO NOT SET throttle - it'll cause messages got re-written after the chat became ready state.
  //    */
  //   // experimental_throttle: 100,
  //   initialMessages,
  //   api: apiClient.api.chat.stream.$url().toString(),
  //   onFinish: (message, { finishReason }) => {
  //     autoApproveGuard.current = true;

  //     let numToolCalls: number | undefined;
  //     if (finishReason === "tool-calls") {
  //       // Find the last step-start index
  //       const lastStepStartIndex =
  //         message.parts?.reduce((lastIndex, part, index) => {
  //           return part.type === "step-start" ? index : lastIndex;
  //         }, -1) ?? -1;

  //       // Count tool invocations only from after the last step-start
  //       numToolCalls =
  //         message.parts
  //           ?.slice(lastStepStartIndex + 1)
  //           .filter((part) => part.type === "tool-invocation").length || 0;
  //     }

  //     vscodeHost.capture({
  //       event: "chatFinish",
  //       properties: {
  //         modelId: selectedModel?.id,
  //         finishReason,
  //         numToolCalls,
  //       },
  //     });
  //   },
  //   experimental_prepareRequestBody: async (req) =>
  //     prepareRequestBody(
  //       uidRef,
  //       req,
  //       await buildEnvironment(),
  //       mcpToolSet,
  //       selectedModel?.modelId,
  //       minionId,
  //       openAIModelOverride,
  //       pochiModelSettings?.modelEndpointId,
  //       req.messages.at(-1)?.role === "user" ? forceCompact.current : undefined,
  //     ),
  //   fetch: async (url, options) => {
  //     let resp: Response | null = null;
  //     let numAttempts = 0;
  //     do {
  //       if (numAttempts > 0) {
  //         await new Promise((res) => setTimeout(res, 1000 * 2 ** numAttempts));
  //       }
  //       numAttempts++;
  //       resp = await fetch(url, options);

  //       // A 409 conflict can occur if the user aborts a streaming request and immediately retries,
  //       // as the task status in the database might still be 'streaming'.
  //       // We use exponential backoff to handle this race condition.
  //     } while (resp.status === 409 && recentAborted.current && numAttempts < 5);

  //     latestHttpCode.current = resp.status;
  //     recentAborted.current = false;
  //     return resp;
  //   },
  //   headers: {
  //     Authorization: `Bearer ${auth.session.token}`,
  //   },
  // });

  const [input, setInput] = useState("");
  const { messages, sendMessage, status, addToolResult } = chat;
  const renderMessages = useMemo(() => formatters.ui(messages), [messages]);
  const buildEnvironment = useCallback(async () => {
    const environment = await vscodeHost.readEnvironment();

    let userEdits: UserEditsDiff[] | undefined;
    const lastCheckpointHash = findLastCheckpointFromMessages(messages);
    if (lastCheckpointHash && autoApproveGuard.current) {
      userEdits =
        (await vscodeHost.diffWithCheckpoint(lastCheckpointHash)) ?? undefined;
    }

    return {
      todos: todosRef.current,
      ...environment,
      userEdits,
    } satisfies Environment;
  }, [messages, autoApproveGuard.current]);

  const { todos } = useTodos({
    initialTodos: task?.todos,
    messages,
    todosRef,
  });

  const isLoading = status === "streaming" || status === "submitted";

  const { inlineCompactTask, inlineCompactTaskPending } = useInlineCompactTask({
    sendMessage,
  });

  const { newCompactTask, newCompactTaskPending } = useNewCompactTask({
    compact: chatKit.spawn,
  });

  const isCompacting = inlineCompactTaskPending || newCompactTaskPending;

  const {
    isExecuting,
    isSubmitDisabled,
    showStopButton,

    showPreview,
    showApproval,
  } = useChatStatus({
    isTaskLoading,
    isModelsLoading,
    isLoading,
    isInputEmpty: !input.trim(),
    isFilesEmpty: files.length === 0,
    isUploadingImages,
    isCompacting,
  });

  const compactEnabled = !(
    isLoading ||
    isTaskLoading ||
    isExecuting ||
    totalTokens < constants.CompactTaskMinTokens
  );

  // FIXME(meng): consider add back auto-resume
  // useAutoResume({
  //   autoResume:
  //     !isTaskLoading &&
  //     task?.status === "streaming" &&
  //     initialMessages.length > 0 &&
  //     initialMessages.length === messages.length,
  //   initialMessages,
  //   experimental_resume,
  //   setMessages,
  //   data,
  // });

  // FIXME(meng): consider add back new task handler.
  // useNewTaskHandler({ data, setUid, enabled: !uidRef.current });

  // const messages: UIMessage = [];

  const { pendingApproval, retry } = useApprovalAndRetry({
    showApproval,
    ...chat,
  });

  // Initialize task with prompt if provided and task doesn't exist yet
  useEffect(() => {
    if (prompt && !chatKit.inited) {
      chatKit.init(prompt);
    }
  }, [prompt, chatKit]);

  usePendingModelAutoStart({
    enabled: status === "ready" && messages.length === 1 && !isTaskLoading,
    task,
    retry,
  });
  const { handleSubmit, handleStop } = useChatSubmit({
    chat,
    input,
    setInput,
    imageUpload,
    isSubmitDisabled,
    isLoading,
    pendingApproval,
    isCompacting,
  });

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
  const allowAddToolResult = !(isLoading || isTaskLoading || isCompacting);
  useAddCompleteToolCalls({
    messages,
    enable: allowAddToolResult,
    addToolResult: addToolResult,
  });

  useHandleChatEvents(isLoading || isTaskLoading ? undefined : sendMessage);

  return (
    <div className="flex h-screen flex-col">
      {showPreview && <PreviewTool messages={messages} />}
      <ChatArea
        messages={renderMessages}
        isTaskLoading={isTaskLoading}
        isLoading={isLoading}
        user={user || defaultUser}
        messagesContainerRef={messagesContainerRef}
      />
      <div className="flex flex-col px-4">
        <ErrorMessageView error={displayError} />
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
              <TodoList todos={todos} className="mt-2">
                <TodoList.Header />
                <TodoList.Items viewportClassname="max-h-48" />
              </TodoList>
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
                  value={selectedModel}
                  models={groupedModels}
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
                    compact={{
                      enabled:
                        compactEnabled &&
                        !inlineCompactTaskPending &&
                        !newCompactTaskPending,
                      inlineCompactTask,
                      inlineCompactTaskPending:
                        inlineCompactTaskPending && !isLoading,
                      newCompactTask,
                      newCompactTaskPending,
                    }}
                  />
                )}
                <DevModeButton
                  messages={messages}
                  buildEnvironment={buildEnvironment}
                  todos={todos}
                />
                <PublicShareButton
                  disabled={isTaskLoading || isModelsLoading}
                  shareId={task?.shareId}
                  modelId={selectedModel?.id}
                  displayError={displayError?.message}
                />
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

function useTaskError(
  status: UseChatHelpers<Message>["status"],
  task?: Task | null,
) {
  const init = useRef(false);
  const [taskError, setTaskError] = useState<Error>();
  useEffect(() => {
    if (init.current || !task) return;
    init.current = true;
    const { error } = task;
    if (error) {
      const e = new Error(error.message);
      e.name = error.kind;
      setTaskError(e);
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

// function useUid(task: Task | null) {
//   const [uid, setUidImpl] = useState<string | undefined>(task?.uid);
//   const uidRef = useRef<string | undefined>(task?.uid);

//   const setUid = useCallback((newUid: string | undefined) => {
//     uidRef.current = newUid;
//     setUidImpl(newUid);
//   }, []);

//   useEffect(() => {
//     if (task) {
//       setUid(task.uid);
//     }
//   }, [task, setUid]);
//   return {
//     uid,
//     uidRef,
//     setUid,
//   };
// }

function findLastCheckpointFromMessages(
  messages: Message[],
): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    for (const part of message.parts) {
      if (part.type === "data-checkpoint" && part.data?.commit) {
        return part.data.commit;
      }
    }
  }
  return undefined;
}

async function appendCheckpoint(message: Message) {
  const lastStepStartIndex =
    message.parts.reduce((lastIndex, part, index) => {
      return part.type === "step-start" ? index : lastIndex;
    }, -1) ?? -1;
  if (
    message.parts
      .slice(lastStepStartIndex + 1)
      .some((x) => x.type === "data-checkpoint")
  ) {
    return;
  }

  const { id } = message;
  const ckpt = await vscodeHost.saveCheckpoint(`ckpt-msg-${id}`, {
    force: message.role === "user",
  });
  if (!ckpt) return;

  message.parts.push({
    type: "data-checkpoint",
    data: {
      commit: ckpt,
    },
  });
}

function useStopBeforeNavigate({
  stop,
}: Pick<UseChatHelpers<Message>, "stop">) {
  const router = useRouter();
  useEffect(() => {
    // Subscribe to the 'onBeforeLoad' event
    const unsubscribe = router.subscribe("onBeforeLoad", () => {
      stop();
    });

    // Clean up the subscription when the component unmounts
    return () => {
      unsubscribe();
    };
  }, [stop, router]);
}
