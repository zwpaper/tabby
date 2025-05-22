import { ModelSelect } from "@/components/model-select";
import { FormEditor } from "@/components/prompt-form/form-editor";
import { ToolInvocationPart } from "@/components/tool-invocation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/auth-client";
import { useIsAtBottom } from "@/lib/hooks/use-is-at-bottom";
import { useSelectedModels } from "@/lib/hooks/use-models";
import { isReadyForRetry, useRetry } from "@/lib/hooks/use-retry";
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "@ai-sdk/ui-utils";
import type {
  Environment,
  ChatRequest as RagdollChatRequest,
  Todo,
} from "@ragdoll/server";
import { fromUIMessage, toUIMessages } from "@ragdoll/server/message-utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { Editor } from "@tiptap/react";
import type {
  Attachment,
  ChatRequestOptions,
  CreateMessage,
  Message,
  TextPart,
} from "ai";
import type { InferResponseType } from "hono/client";
import {
  ImageIcon,
  Loader2,
  SendHorizonal,
  StopCircleIcon,
  UserIcon,
} from "lucide-react";
import type React from "react";
import {
  type MutableRefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { z } from "zod";

import "@/components/prompt-form/prompt-form.css";
import {
  ApprovalButton,
  type PendingApproval,
  usePendingApproval,
} from "@/components/approval-button";
import { DevModeButton } from "@/components/dev-mode-button"; // Added import
import { EmptyChatPlaceholder } from "@/components/empty-chat-placeholder";
import { ImagePreviewList } from "@/components/image-preview-list";
import { useUploadImage } from "@/components/image-preview-list/use-upload-image";
import { MessageAttachments, MessageMarkdown } from "@/components/message";
import { PreviewTool } from "@/components/preview-tool";
import { AutoApproveMenu } from "@/components/settings/auto-approve-menu";
import { TodoList } from "@/components/todo/todo-list";
import { useTodos } from "@/components/todo/use-todos";
import { TokenUsage } from "@/components/token-usage";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { WorkspaceRequiredPlaceholder } from "@/components/workspace-required-placeholder";
import { DefaultModelId, MaxImages } from "@/lib/constants";
import { useAutoResume } from "@/lib/hooks/use-auto-resume";
import { useCurrentWorkspace } from "@/lib/hooks/use-current-workspace";
import { useIsDevMode } from "@/lib/hooks/use-is-dev-mode";
import { useSettingsStore } from "@/lib/stores/settings-store";
import { cn } from "@/lib/utils";
import {
  createImageFileName,
  isDuplicateFile,
  processImageFiles,
  validateImages,
} from "@/lib/utils/image";
import type { DataPart } from "@/lib/utils/message";
import { vscodeHost } from "@/lib/vscode";
import { isAutoInjectTool, isUserInputTool } from "@ragdoll/tools";
import type { ResourceURI } from "@ragdoll/vscode-webui-bridge";

const searchSchema = z.object({
  taskId: z
    .number()
    .or(z.enum(["new"]))
    .optional(),
  prompt: z.string().optional(),
  attachments: z
    .array(
      z.object({
        url: z.string(),
        name: z.string().optional(),
        contentType: z.string().optional(),
      }),
    )
    .optional(),
  ts: z.number().optional(),
});

export const Route = createFileRoute("/_auth/")({
  validateSearch: (search) => searchSchema.parse(search),
  component: RouteComponent,
});

function RouteComponent() {
  const {
    taskId: taskIdFromRoute,
    prompt,
    attachments,
    ts = Date.now(),
  } = Route.useSearch();
  const key =
    typeof taskIdFromRoute === "number"
      ? `task-${taskIdFromRoute}`
      : `new-${ts}`;

  const initMessage: CreateMessage | undefined =
    taskIdFromRoute === "new" && prompt !== undefined
      ? {
          role: "user",
          content: prompt,
          experimental_attachments: attachments?.map((item) => {
            return {
              url: atob(item.url),
              name: item.name,
              contentType: item.contentType,
            };
          }),
        }
      : undefined;

  const { data: loaderData, isLoading: isTaskLoading } = useQuery({
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
    enabled: typeof taskIdFromRoute === "number",
  });

  return (
    <Chat
      key={key}
      loaderData={loaderData || null}
      isTaskLoading={isTaskLoading}
      initMessage={initMessage}
    />
  );
}

interface ChatProps {
  loaderData: InferResponseType<
    (typeof apiClient.api.tasks)[":id"]["$get"]
  > | null;
  isTaskLoading: boolean;
  initMessage: CreateMessage | undefined;
}

function Chat({ loaderData, isTaskLoading, initMessage }: ChatProps) {
  const [isDevMode] = useIsDevMode();
  const taskId = useRef<number | undefined>(loaderData?.id);
  const [totalTokens, setTotalTokens] = useState<number>(
    loaderData?.totalTokens || 0,
  );

  useEffect(() => {
    taskId.current = loaderData?.id;
    if (loaderData) {
      setTotalTokens(loaderData.totalTokens || 0);
    }
  }, [loaderData]);

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

  const chatHasFinishedOnce = useRef(false);
  const latestHttpCode = useRef<number | undefined>(undefined);
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
    experimental_resume,
  } = useChat({
    initialMessages,
    api: apiClient.api.chat.stream.$url().toString(),
    onFinish: (_, { usage }) => {
      chatHasFinishedOnce.current = true;

      if (usage.totalTokens) {
        setTotalTokens(usage.totalTokens);
      }
    },
    experimental_prepareRequestBody: (req) =>
      prepareRequestBody(taskId, req, selectedModel?.id),
    fetch: async (url, options) => {
      const resp = await fetch(url, {
        ...options,
        body:
          options?.body &&
          JSON.stringify({
            ...JSON.parse(options.body as string),
            // Inject the environment variables into the request body
            environment: await buildEnvironment(),
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

  const initialError = isReadyForRetry(messages)
    ? new Error("Streaming failed in previous session")
    : undefined;

  const { todos } = useTodos({
    initialTodos: loaderData?.todos,
    messages,
    todosRef,
  });

  useAutoResume({
    autoResume:
      loaderData?.status === "streaming" &&
      initialMessages.length > 0 &&
      initialMessages.length === messages.length,
    initialMessages,
    experimental_resume,
    setMessages,
    data,
  });

  const initMessageSent = useRef<boolean>(false);
  useEffect(() => {
    if (
      taskId.current === undefined &&
      initMessage &&
      !initMessageSent.current
    ) {
      initMessageSent.current = true;
      append(initMessage);
    }
  }, [initMessage, append]);

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
    if (isUploadingImages) {
      stopUpload();
    } else if (isLoading) {
      stop();
    }
  };

  const updateSelectedModelId = useSettingsStore(
    (x) => x.updateSelectedModelId,
  );

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
    if (!data || data.length === 0 || taskId.current !== undefined) return;

    const dataParts = data as DataPart[];
    for (const part of dataParts) {
      if (part.type === "append-id") {
        taskId.current = part.id;

        queryClient.invalidateQueries({ queryKey: ["tasks"] });

        vscodeHost.setSessionState({
          lastVisitedRoute: `/?taskId=${taskId.current}`,
        });
        return;
      }
    }
  }, [data, queryClient]);

  const isLoading = status === "streaming" || status === "submitted";

  const editorRef = useRef<Editor | null>(null);

  const renderMessages = createRenderMessages(messages);
  const retry = useRetry({
    messages,
    append,
    setMessages,
    reload,
    experimental_resume,
    latestHttpCode,
  });
  const { pendingApproval, setIsExecuting, executingToolCallId } =
    usePendingApproval({
      error: error || initialError,
      messages: renderMessages,
    });

  // Workaround for https://github.com/vercel/ai/issues/4491#issuecomment-2848999826
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

  // Display errors with priority: 1. imageSelectionError, 2. uploadImageError, 3. error
  const displayError = imageSelectionError || uploadImageError || error;
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
      <Messages
        messages={renderMessages}
        user={authData.user}
        logo={resourceUri?.logo128}
        sendMessage={append}
        isLoading={isLoading}
        executingToolCallId={executingToolCallId}
        containerRef={messagesContainerRef}
      />
      <div className="flex flex-col px-4">
        {displayError && (
          <div
            className={cn("mb-2 text-center text-red-500 dark:text-red-400", {
              "cursor-help": isDevMode,
            })}
            onClick={isDevMode ? () => console.error(displayError) : undefined}
          >
            {displayError.message}
          </div>
        )}
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
              isLoading={isLoading}
              retry={retry}
              pendingApproval={pendingApproval}
              addToolResult={addToolResultWithForceUpdate}
              executingToolCallId={executingToolCallId}
              setIsExecuting={setIsExecuting}
              chatHasFinishedOnce={chatHasFinishedOnce.current}
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
              isLoading={isModelsLoading || isLoading || isTaskLoading}
              formRef={formRef}
              editorRef={editorRef}
              onPaste={handlePasteImage}
            >
              {false && taskId.current && (
                <span className="absolute top-1 right-2 text-foreground/80 text-xs">
                  TASK-{String(taskId.current).padStart(3, "0")}
                </span>
              )}
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
                  disabled={
                    isTaskLoading ||
                    isModelsLoading ||
                    (!isLoading && !input && files.length === 0)
                  }
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

export const Messages: React.FC<{
  messages: UIMessage[];
  user: { name: string; image?: string | null };
  logo?: string;
  sendMessage: (
    message: Message | CreateMessage,
    chatRequestOptions?: ChatRequestOptions,
  ) => Promise<string | null | undefined>;
  isLoading: boolean;
  executingToolCallId?: string;
  containerRef?: React.RefObject<HTMLDivElement>;
}> = ({
  messages: renderMessages,
  isLoading,
  user,
  logo,
  sendMessage,
  executingToolCallId,
  containerRef,
}) => {
  return (
    <ScrollArea className="mb-2 flex-1 overflow-y-auto px-4" ref={containerRef}>
      {renderMessages.map((m, messageIndex) => (
        <div key={m.id} className="flex flex-col">
          <div className="rounded-lg py-2">
            <div className="flex items-center gap-2">
              {m.role === "user" ? (
                <Avatar className="size-7">
                  <AvatarImage src={user.image ?? undefined} />
                  <AvatarFallback
                    className={cn(
                      "bg-[var(--vscode-chat-avatarBackground)] text-[var(--vscode-chat-avatarForeground)] text-xs uppercase",
                    )}
                  >
                    {user.name.slice(0, 2) || (
                      <UserIcon className={cn("size-[50%]")} />
                    )}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <Avatar className="size-7">
                  <AvatarImage src={logo} className="scale-110" />
                  <AvatarFallback className="bg-[var(--vscode-chat-avatarBackground)] text-[var(--vscode-chat-avatarForeground)]" />
                </Avatar>
              )}
              <strong>{m.role === "user" ? user.name : "Pochi"}</strong>
            </div>
            <div className="mt-3 ml-1 flex flex-col gap-2">
              {m.parts.map((part, index) => (
                <Part
                  key={index}
                  message={m}
                  part={part}
                  isLoading={isLoading}
                  sendMessage={sendMessage}
                  executingToolCallId={executingToolCallId}
                />
              ))}
            </div>
            {/* Display attachments at the bottom of the message */}
            {m.role === "user" && !!m.experimental_attachments?.length && (
              <div className="mt-3">
                <MessageAttachments attachments={m.experimental_attachments} />
              </div>
            )}
          </div>
          {messageIndex < renderMessages.length - 1 && (
            <Separator className="mt-1 mb-2" />
          )}
        </div>
      ))}
      {isLoading && (
        <div className="pb-4">
          <Loader2 className="mx-auto size-6 animate-spin" />
        </div>
      )}
    </ScrollArea>
  );
};

function Part({
  message,
  part,
  executingToolCallId,
  sendMessage,
  isLoading,
}: {
  message: UIMessage;
  part: NonNullable<UIMessage["parts"]>[number];
  sendMessage: (
    message: Message | CreateMessage,
    chatRequestOptions?: ChatRequestOptions,
  ) => Promise<string | null | undefined>;
  executingToolCallId: string | undefined;
  isLoading: boolean;
}) {
  if (part.type === "text") {
    return <TextPartUI message={message} part={part} />;
  }

  if (part.type === "step-start") {
    return null;
  }

  if (part.type === "tool-invocation") {
    if (isAutoInjectTool(part.toolInvocation.toolName)) {
      return null;
    }

    return (
      <ToolInvocationPart
        tool={part.toolInvocation}
        sendMessage={sendMessage}
        executingToolCallId={executingToolCallId}
        isLoading={isLoading}
      />
    );
  }

  return <div>{JSON.stringify(part)}</div>;
}

function TextPartUI({ message, part }: { message: UIMessage; part: TextPart }) {
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

function createRenderMessages(messages: UIMessage[]): UIMessage[] {
  const x = messages.map((message, index) => {
    if (index < messages.length - 1 && message.role === "assistant") {
      const parts = message.parts.map((part) => {
        if (
          part.type === "tool-invocation" &&
          part.toolInvocation.state !== "result" &&
          !isUserInputTool(part.toolInvocation.toolName)
        ) {
          // Tools have already been rejected on the server side.
          // Here, we only need to ensure they are rendered to the user in a consistent manner.
          return {
            ...part,
            toolInvocation: {
              ...part.toolInvocation,
              state: "result",
              result: {
                error: "User cancelled the tool call.",
              },
            },
          } satisfies UIMessage["parts"][number];
        }
        return part;
      });
      return {
        ...message,
        parts,
      };
    }
    return message;
  });

  return x;
}

const useResourceURI = () => {
  const [resourceURI, setResourceURI] = useState<ResourceURI>();
  useEffect(() => {
    vscodeHost.readResourceURI().then(setResourceURI);
  }, []);
  return resourceURI;
};

// Helper function
function pendingApprovalKey(
  pendingApproval: PendingApproval | undefined,
): string | undefined {
  if (!pendingApproval) {
    return;
  }
  if (pendingApproval.name === "retry") {
    return "retry";
  }
  return pendingApproval.tool.toolCallId;
}
