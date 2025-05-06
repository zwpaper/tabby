import { ModelSelect } from "@/components/model-select";
import { FormEditor } from "@/components/prompt-form/form-editor";
import { ToolInvocationPart } from "@/components/tool-invocation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/auth-client";
import { useSelectedModels } from "@/lib/hooks/use-models";
import { type UseChatHelpers, useChat } from "@ai-sdk/react";
import {
  type UIMessage,
  isAssistantMessageWithCompletedToolCalls,
} from "@ai-sdk/ui-utils";
import type { ChatRequest as RagdollChatRequest } from "@ragdoll/server";
import { fromUIMessage, toUIMessages } from "@ragdoll/server/message-utils";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import type { TextPart, ToolInvocation } from "ai";
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

const searchSchema = z.object({
  taskId: z
    .number()
    .or(z.enum(["new"]))
    .optional(),
  ts: z.number().optional(),
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
});

function RouteComponent() {
  const { taskId, ts = Date.now() } = Route.useSearch();
  const key = typeof taskId === "number" ? `task-${taskId}` : `new-${ts}`;
  return <Chat key={key} />;
}

function Chat() {
  const loaderData = Route.useLoaderData();
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
    handleSubmit,
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
    if (files.length > 0) {
      e.preventDefault();
      const uploadedImages = await uploadImages();
      handleSubmit(e, {
        experimental_attachments: uploadedImages,
      });
      // Clear files after successful upload
      setFiles([]);
    } else {
      clearUploadImageError();
      handleSubmit(e);
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
    }
  }, [data, queryClient]);

  const isLoading = status === "streaming" || status === "submitted";

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

  const renderMessages = createRenderMessages(messages, isLoading);
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

  return (
    <div className="flex flex-col h-screen px-4">
      <PreviewToolCalls message={renderMessages.at(-1)} />
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
      </div>
      <div className="text-red-400 text-center mb-2">
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
        isLoading={isLoading}
        formRef={formRef}
        onPaste={handlePasteImage}
      >
        {taskId.current && (
          <span className="text-xs absolute top-1 right-1 text-foreground/80">
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

      <div className="flex mb-2 justify-between pt-2 gap-3">
        <ModelSelect
          value={selectedModel?.id}
          models={models}
          isLoading={isModelsLoading}
          onChange={handleSelectModel}
          triggerClassName="py-0 h-6"
        />

        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            className="p-0 h-6 w-6 rounded-md"
          >
            <ImageIcon className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={isModelsLoading || (!isLoading && !input)}
            className="p-0 h-6 w-6 rounded-md transition-opacity"
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
    <div className="flex [&>button]:flex-1 [&>button]:rounded-sm gap-3 mb-2">
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

function createRenderMessages(
  messages: UIMessage[],
  isLoading: boolean,
): UIMessage[] {
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
