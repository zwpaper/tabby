import { ModelSelect } from "@/components/model-select";
import { FormEditor } from "@/components/prompt-form/form-editor";
import { ToolInvocationPart } from "@/components/tool-invocation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/auth-client";
import { useIsAtBottom } from "@/lib/hooks/use-is-at-bottom";
import { useSelectedModels } from "@/lib/hooks/use-models";
import { type UseChatHelpers, useChat } from "@ai-sdk/react";
import {
  type UIMessage,
  isAssistantMessageWithCompletedToolCalls,
} from "@ai-sdk/ui-utils";
import type { ChatRequest as RagdollChatRequest } from "@ragdoll/server";
import { fromUIMessage, toUIMessages } from "@ragdoll/server/message-utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { Editor } from "@tiptap/react";
import type { Attachment, CreateMessage, TextPart, ToolInvocation } from "ai";
import type { InferResponseType } from "hono/client";
import {
  ImageIcon,
  Loader2,
  SendHorizonal,
  StopCircleIcon,
} from "lucide-react";
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

import "@/components/prompt-form/prompt-form.css";
import { EmptyChatPlaceholder } from "@/components/empty-chat-placeholder";
import { ImagePreviewList } from "@/components/image-preview-list";
import { useUploadImage } from "@/components/image-preview-list/use-upload-image";
import { MessageAttachments, MessageMarkdown } from "@/components/message";
import { AutoApproveMenu } from "@/components/settings/auto-approve-menu";
import { Separator } from "@/components/ui/separator";
import { MAX_IMAGES } from "@/lib/constants";
import { useVSCodeTool } from "@/lib/hooks/use-vscode-tool";
import {
  useSettingsStore,
  useToolAutoApproval,
} from "@/lib/stores/settings-store";
import {
  createImageFileName,
  isDuplicateFile,
  processImageFiles,
  validateImages,
} from "@/lib/utils/image";
import { vscodeHost } from "@/lib/vscode";
import {
  type ClientToolsType,
  isAutoInjectTool,
  isUserInputTool,
} from "@ragdoll/tools";
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

export const Route = createFileRoute("/")({
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
  const taskId = useRef<number | undefined>(loaderData?.id);
  useEffect(() => {
    taskId.current = loaderData?.id;
  }, [loaderData]);

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
      MAX_IMAGES,
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
  } = useChat({
    initialMessages,
    api: apiClient.api.chat.stream.$url().toString(),
    experimental_prepareRequestBody: (req) =>
      prepareRequestBody(taskId, req, selectedModel?.id),
    fetch: async (url, options) =>
      fetch(url, {
        ...options,
        body: JSON.stringify({
          ...JSON.parse(options?.body as string),
          // Inject the environment variables into the request body
          environment: await vscodeHost.readEnvironment(),
        }),
      }),
    headers: {
      Authorization: `Bearer ${authData.session.token}`,
    },
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
    if (
      taskId.current === undefined &&
      typeof data?.[0] === "object" &&
      data[0] &&
      "id" in data[0] &&
      typeof data[0].id === "number"
    ) {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      taskId.current = data[0].id;

      vscodeHost.setSessionState({
        lastVisitedRoute: `/?taskId=${taskId.current}`,
      });
    }
  }, [data, queryClient]);

  const isLoading = status === "streaming" || status === "submitted";

  const editorRef = useRef<Editor | null>(null);

  const setInputAndFocus = (input: string) => {
    setInput(input);
    if (editorRef.current) {
      editorRef.current.commands.focus();
    }
  };

  const renderMessages = createRenderMessages(messages);
  const retry = useRetry({ messages, append, setMessages, reload });
  const { pendingApproval, setIsExecuting, executingToolCallId } =
    usePendingApproval({
      error,
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

  return (
    <div className="flex h-screen flex-col px-4">
      {renderMessages.length === 0 &&
        (isTaskLoading ? (
          <div className="flex h-full w-full items-center justify-center">
            <Loader2 className="animate-spin" />
          </div>
        ) : (
          <EmptyChatPlaceholder />
        ))}
      {renderMessages.length > 0 && <div className="h-4" />}
      <PreviewToolCalls message={renderMessages.at(-1)} />
      <div
        className="-mx-4 mb-2 flex-1 space-y-4 overflow-y-auto px-4"
        ref={messagesContainerRef}
      >
        {renderMessages.map((m, messageIndex) => (
          <div key={m.id} className="flex flex-col">
            <div className="rounded-lg py-2">
              <div className="flex items-center gap-2">
                {m.role === "user" ? (
                  <Avatar className="size-7">
                    <AvatarImage src={authData.user.image ?? undefined} />
                    <AvatarFallback>{authData.user.name}</AvatarFallback>
                  </Avatar>
                ) : (
                  <Avatar className="size-7">
                    <AvatarImage
                      src={resourceUri?.logo128}
                      className="scale-110"
                    />
                    <AvatarFallback>Pochi</AvatarFallback>
                  </Avatar>
                )}
                <strong>
                  {m.role === "user" ? authData.user.name : "Pochi"}
                </strong>
              </div>
              <div className="mt-3 ml-1 flex flex-col gap-2">
                {m.parts.map((part, index) => (
                  <Part
                    key={index}
                    message={m}
                    part={part}
                    setInput={setInputAndFocus}
                    executingToolCallId={executingToolCallId}
                  />
                ))}
              </div>
              {/* Display attachments at the bottom of the message */}
              {m.role === "user" && !!m.experimental_attachments?.length && (
                <div className="mt-3">
                  <MessageAttachments
                    attachments={m.experimental_attachments}
                  />
                </div>
              )}
            </div>
            {messageIndex < renderMessages.length - 1 && <Separator />}
          </div>
        ))}
        {isLoading && (
          <div className="pb-4">
            <Loader2 className="mx-auto size-6 animate-spin" />
          </div>
        )}
      </div>
      <div className="mb-2 text-center text-red-400">
        {/* Display errors with priority: 1. imageSelectionError, 2. uploadImageError, 3. error */}
        {imageSelectionError?.message ||
          uploadImageError?.message ||
          error?.message}
      </div>
      <ApprovalButton
        key={pendingApprovalKey(pendingApproval)}
        isLoading={isLoading}
        retry={retry}
        pendingApproval={pendingApproval}
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
        isLoading={isModelsLoading || isLoading || isTaskLoading}
        formRef={formRef}
        editorRef={editorRef}
        onPaste={handlePasteImage}
      >
        {taskId.current && (
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

      <div className="my-2 flex shrink-0 justify-between gap-3 overflow-x-hidden">
        <ModelSelect
          value={selectedModel?.id}
          models={models}
          isLoading={isModelsLoading}
          onChange={handleSelectModel}
        />

        <div className="flex shrink-0 items-center gap-1">
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
    </div>
  );
}

function Part({
  message,
  part,
  setInput,
  executingToolCallId,
}: {
  message: UIMessage;
  part: NonNullable<UIMessage["parts"]>[number];
  setInput: (prompt: string) => void;
  executingToolCallId: string | undefined;
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
        setInput={setInput}
        executingToolCallId={executingToolCallId}
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
  const message = fromUIMessage(request.messages[request.messages.length - 1]);
  const triggerError =
    message.parts[0].type === "text" &&
    message.parts[0].text.includes("RAGDOLL_DEBUG_TRIGGER_ERROR");
  return {
    id: taskId.current?.toString(),
    model: triggerError ? "fake-model" : model,
    message: fromUIMessage(request.messages[request.messages.length - 1]),
  };
}

interface ApprovalButtonProps {
  isLoading: boolean;
  pendingApproval?: PendingApproval;
  retry: () => void;
  addToolResult: ({
    toolCallId,
    result,
  }: {
    toolCallId: string;
    result: unknown;
  }) => void;

  setIsExecuting: React.Dispatch<React.SetStateAction<boolean>>;
  executingToolCallId?: string;
}

const ApprovalButton: React.FC<ApprovalButtonProps> = ({
  isLoading,
  pendingApproval,
  retry,
  addToolResult,
  setIsExecuting,
  executingToolCallId,
}) => {
  if (isLoading || !pendingApproval) return;
  const { executeTool, rejectTool, abortTool } = useVSCodeTool({
    addToolResult,
  });

  // Abort tool is not used yet, it can be used to implement tool cancellation
  abortTool;

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
  const shouldSkipExecute = useShouldSkipExecute();

  const onAccept = useCallback(async () => {
    if (pendingApproval.name === "retry") {
      retry();
    } else {
      if (shouldSkipExecute()) {
        return;
      }

      try {
        setIsExecuting(true);
        await executeTool(pendingApproval.tool);
      } finally {
        setIsExecuting(false);
      }
    }
  }, [shouldSkipExecute, pendingApproval, retry, executeTool, setIsExecuting]);

  const onReject = useCallback(() => {
    if (pendingApproval.name !== "retry") {
      if (shouldSkipExecute()) {
        return;
      }
      rejectTool(pendingApproval.tool);
    }
  }, [shouldSkipExecute, pendingApproval, rejectTool]);

  const isAutoApproved = useToolAutoApproval(pendingApproval.name);
  const isAutoRejected = isAutoInjectTool(pendingApproval.name);

  useEffect(() => {
    if (isAutoApproved) {
      onAccept();
    } else if (isAutoRejected) {
      onReject();
    }
  }, [isAutoApproved, isAutoRejected, onAccept, onReject]);

  if (executingToolCallId) {
    return null;
  }

  return (
    <div className="mb-2 flex gap-3 [&>button]:flex-1 [&>button]:rounded-sm">
      <Button onClick={onAccept}>{acceptText}</Button>
      {pendingApproval.name !== "retry" && (
        <Button onClick={onReject} variant="secondary">
          {rejectText}
        </Button>
      )}
    </div>
  );
};

function useRetry({
  messages,
  setMessages,
  append,
  reload,
}: {
  messages: UIMessage[];
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

function createRenderMessages(messages: UIMessage[]): UIMessage[] {
  const x = messages.map((message, index) => {
    if (index < messages.length - 1 && message.role === "assistant") {
      for (let i = 0; i < message.parts.length; i++) {
        const part = message.parts[i];
        if (
          part.type === "tool-invocation" &&
          part.toolInvocation.state !== "result" &&
          !isUserInputTool(part.toolInvocation.toolName)
        ) {
          // Tools have already been rejected on the server side.
          // Here, we only need to ensure they are rendered to the user in a consistent manner.
          part.toolInvocation = {
            ...part.toolInvocation,
            state: "result",
            result: {
              error: "User cancelled the tool call.",
            },
          };
        }
      }
    }
    return message;
  });

  return x;
}

type PendingApproval =
  | {
      name: "retry";
    }
  | {
      name: keyof ClientToolsType;
      tool: ToolInvocation;
    };

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

function usePendingApproval({
  error,
  messages,
}: { error?: Error; messages: UIMessage[] }) {
  const [isExecuting, setIsExecuting] = useState(false);

  const pendingApproval = useMemo((): PendingApproval | undefined => {
    if (error) {
      return {
        name: "retry",
      };
    }

    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role !== "assistant") {
      return undefined;
    }

    for (const part of lastMessage.parts) {
      if (
        part.type === "tool-invocation" &&
        part.toolInvocation.state === "call" &&
        !isUserInputTool(part.toolInvocation.toolName)
      ) {
        return {
          name: part.toolInvocation.toolName as keyof ClientToolsType,
          tool: part.toolInvocation,
        };
      }
    }
    return undefined;
  }, [error, messages]);

  const executingToolCallId = useMemo(() => {
    if (pendingApproval && pendingApproval.name !== "retry" && isExecuting) {
      return pendingApproval.tool.toolCallId;
    }
    return undefined;
  }, [pendingApproval, isExecuting]);

  // Reset isExecuting when pendingApproval changes or disappears
  useEffect(() => {
    if (!pendingApproval || pendingApproval.name === "retry") {
      setIsExecuting(false);
    }
  }, [pendingApproval]);

  return { pendingApproval, setIsExecuting, executingToolCallId };
}

function PreviewToolCalls({ message }: { message?: UIMessage }) {
  return message?.parts.map((part, index) => {
    if (part.type === "tool-invocation") {
      return <PreviewToolCall key={index} tool={part.toolInvocation} />;
    }
    return null;
  });
}

function PreviewToolCall({ tool }: { tool: ToolInvocation }) {
  const { state, args, toolCallId, toolName } = tool;
  useEffect(() => {
    if (state === "result") return;
    vscodeHost.previewToolCall(toolName, args, {
      toolCallId,
      state,
    });
  }, [state, args, toolCallId, toolName]);
  return <></>;
}

function useShouldSkipExecute() {
  const executed = useRef(false);
  const canExecute = useCallback(() => {
    if (executed.current) {
      return true;
    }
    executed.current = true;
    return false;
  }, []);
  return canExecute;
}

const useResourceURI = () => {
  const [resourceURI, setResourceURI] = useState<ResourceURI>();
  useEffect(() => {
    vscodeHost.readResourceURI().then(setResourceURI);
  }, []);
  return resourceURI;
};
