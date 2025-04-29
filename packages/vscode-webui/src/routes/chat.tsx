import { MessageMarkdown } from "@/components/message-markdown";
import { ModelSelect } from "@/components/model-select";
import Pending from "@/components/pending";
import { ToolInvocationPart } from "@/components/tool-invocation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/auth-client";
import { useEnvironment } from "@/lib/hooks/use-environment";
import { useSelectedModels } from "@/lib/hooks/use-models";
import { useChatStore } from "@/lib/stores/chat-store";
import { vscodeHost } from "@/lib/vscode";
import { type Message, useChat } from "@ai-sdk/react";
import type {
  Environment,
  ChatRequest as RagdollChatRequest,
} from "@ragdoll/server";
import { fromUIMessage, toUIMessages } from "@ragdoll/server/message-utils";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import type { TextPart } from "ai";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  Loader2,
  StopCircleIcon,
} from "lucide-react";
import {
  type MutableRefObject,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { z } from "zod";

import { PromptFormMentionExtension } from "@/components/prompt-form/mention-extension";
import {
  MentionList,
  type MentionListActions,
  type MentionListProps,
} from "@/components/prompt-form/mention-list";
import type { CommandProps } from "@/components/prompt-form/types";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Placeholder from "@tiptap/extension-placeholder";
import Text from "@tiptap/extension-text";
import {
  EditorContent,
  Extension,
  ReactRenderer,
  useEditor,
} from "@tiptap/react";
import tippy from "tippy.js";
import "@/components/prompt-form/prompt-form.css";
import { Separator } from "@/components/ui/separator";

const searchSchema = z.object({
  taskId: z.number().optional(),
});

// Custom keyboard shortcuts extension that handles Enter key behavior
function CustomEnterKeyHandler(doSubmit: () => void) {
  return Extension.create({
    addKeyboardShortcuts() {
      return {
        "Shift-Enter": () => {
          return this.editor.commands.first(() => [
            () => this.editor.commands.newlineInCode(),
            () => this.editor.commands.createParagraphNear(),
            () => this.editor.commands.liftEmptyBlock(),
            () => this.editor.commands.splitBlock(),
          ]);
        },
        Enter: ({ editor }) => {
          const isMentionSuggestionActive =
            editor.isActive("mention") ||
            document.querySelector(".tippy-box") !== null;

          if (!isMentionSuggestionActive) {
            doSubmit();
            return true;
          }
          return false;
        },
      };
    },
  });
}

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
  const clearPendingToolApproval = useChatStore(
    (x) => x.clearPendingToolApproval,
  );
  useLayoutEffect(() => {
    clearPendingToolApproval();
  }, [clearPendingToolApproval]);

  const loaderData = Route.useLoaderData();
  const taskId = useRef<number | undefined>(loaderData?.id);
  const { auth: authData } = Route.useRouteContext();
  const { environment } = useEnvironment();
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
    setInput,
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

  const doSubmit = () => {
    if (isLoading || !editor || editor.isEmpty) return;

    formRef.current?.requestSubmit();
  };

  // Set up the TipTap editor with mention extension
  const editor = useEditor(
    {
      extensions: [
        Document,
        Paragraph,
        Text,
        Placeholder.configure({
          placeholder: "Ask anything, @ to mention",
        }),
        CustomEnterKeyHandler(doSubmit),
        PromptFormMentionExtension.configure({
          suggestion: {
            char: "@",
            items: async ({ query }: { query: string }) => {
              // Fetch files and return { id, filepath }
              const files = await vscodeHost.listFilesInWorkspace({
                query,
              });
              return files.map((file) => ({
                id: file,
                filepath: file,
              }));
            },
            render: () => {
              let component: ReactRenderer<
                MentionListActions,
                MentionListProps
              >;
              let popup: Array<{ destroy: () => void; hide: () => void }>;

              // Fetch items function for MentionList
              const fetchItems = async (query?: string) => {
                const files = await vscodeHost.listFilesInWorkspace({
                  query: query || "",
                });
                return files.map((file) => ({ id: file, filepath: file }));
              };

              return {
                onStart: (props) => {
                  const tiptapProps = props as {
                    editor: unknown;
                    clientRect?: () => DOMRect;
                  };

                  component = new ReactRenderer(MentionList, {
                    props: {
                      ...props,
                      fetchItems,
                    },
                    editor: props.editor,
                  });

                  if (!tiptapProps.clientRect) {
                    return;
                  }

                  // @ts-ignore - accessing extensionManager and methods
                  const customExtension =
                    props.editor.extensionManager?.extensions.find(
                      // @ts-ignore - extension type
                      (extension) =>
                        extension.name === "custom-enter-key-handler",
                    );
                  if (customExtension) {
                    // @ts-ignore - method exists but TypeScript doesn't know
                    customExtension.setMentionListActive(true);
                  }

                  popup = tippy("body", {
                    getReferenceClientRect: tiptapProps.clientRect,
                    appendTo: () => document.body,
                    content: component.element,
                    showOnCreate: true,
                    interactive: true,
                    trigger: "manual",
                    placement: "top-start",
                    maxWidth: "none",
                    onHide: () => {
                      if (customExtension) {
                        // @ts-ignore - method exists but TypeScript doesn't know
                        customExtension.setMentionListActive(false);
                      }
                    },
                  });
                },
                onUpdate: (props) => {
                  component.updateProps(props);
                },
                onExit: () => {
                  popup[0].destroy();
                  component.destroy();
                },
                onKeyDown: (props: unknown) => {
                  const keyProps = props as { event: KeyboardEvent };
                  if (keyProps.event.key === "Escape") {
                    popup[0].hide();
                    return true;
                  }

                  if (keyProps.event.key === "Enter") {
                    keyProps.event.stopPropagation();
                    keyProps.event.preventDefault();
                  }

                  return (
                    (
                      component.ref as {
                        onKeyDown: (props: unknown) => boolean;
                      }
                    )?.onKeyDown(props) ?? false
                  );
                },
              };
            },
          },
        }),
      ],
      editorProps: {
        attributes: {
          class:
            "prose min-h-[3.5em] font-sans dark:prose-invert focus:outline-none prose-p:my-0",
        },
      },
      onUpdate(props) {
        const text = props.editor.getText();
        setInput(text);
      },
    },
    [],
  );

  // Update editor content when input changes
  useEffect(() => {
    if (editor && input !== editor.getText()) {
      editor.commands.setContent(input);
    }
  }, [editor, input]);

  const onInsertMention = () => {
    if (!editor) return;

    editor
      .chain()
      .focus()
      .command(({ tr, state }: CommandProps) => {
        const { $from } = state.selection;
        const isAtLineStart = $from.parentOffset === 0;
        const isPrecededBySpace =
          $from.nodeBefore?.text?.endsWith(" ") ?? false;

        if (isAtLineStart || isPrecededBySpace) {
          tr.insertText("@");
        } else {
          tr.insertText(" @");
        }

        return true;
      })
      .run();
  };

  const focusEditor = () => {
    if (editor && !editor.isFocused) {
      editor.commands.focus();
    }
  };

  const updateSelectedModelId = useChatStore((x) => x.updateSelectedModelId);
  const handleSelectModel = (v: string) => {
    updateSelectedModelId(v);
    setTimeout(() => {
      focusEditor();
    }, 50);
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

  const { history } = useRouter();

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

  useEffect(() => {
    if (status === "ready" && editor && !editor.isEmpty) {
      editor.commands.clearContent();
    }
  }, [status, editor]);

  return (
    <div className="flex flex-col h-screen px-4">
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
        {renderMessages.map((m, index) => (
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
                    addToolResult={addToolResult}
                  />
                ))}
              </div>
            </div>
            {index < renderMessages.length - 1 && <Separator />}
          </div>
        ))}
      </div>
      <ApprovalButton show={!isLoading} />
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="bg-input p-2 rounded-sm border border-[var(--input-border)] focus-within:border-ring transition-color duration-300"
        onClick={(e) => {
          e.stopPropagation();
          focusEditor();
        }}
        onKeyDown={() => {}}
      >
        <EditorContent
          editor={editor}
          className="max-h-32 w-full overflow-y-auto prose overflow-hidden break-words text-[var(--vscode-input-foreground)] focus:outline-none !border-none"
        />
        <div className="flex justify-between items-center pt-2 gap-3">
          <Button
            variant="ghost"
            size="icon"
            type="button"
            className="h-6 w-6"
            onClick={onInsertMention}
          >
            @
          </Button>
          <div className="flex items-center gap-2">
            <ModelSelect
              value={selectedModel?.id}
              models={models}
              isLoading={isModelsLoading}
              onChange={handleSelectModel}
              triggerClassName="py-0 h-6"
            />
            <Button
              type="button"
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
                <StopCircleIcon className="h-3 w-3" />
              ) : (
                <ArrowRightIcon className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

function Part({
  message,
  part,
  addToolResult,
}: {
  message: Message;
  part: NonNullable<Message["parts"]>[number];
  addToolResult: ({
    toolCallId,
    result,
  }: {
    toolCallId: string;
    result: unknown;
  }) => void;
}) {
  if (part.type === "text") {
    return <TextPartUI message={message} part={part} />;
  }

  if (part.type === "step-start") {
    return null;
  }

  if (part.type === "tool-invocation") {
    return (
      <ToolInvocationPart
        tool={part.toolInvocation}
        addToolResult={addToolResult}
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
  return {
    id: taskId.current?.toString(),
    model,
    message: fromUIMessage(request.messages[request.messages.length - 1]),
    environment: environment.current || undefined,
  };
}

function ApprovalButton({ show }: { show: boolean }) {
  const { pendingToolApproval, resolvePendingToolApproval } = useChatStore();
  if (!show || !pendingToolApproval) return;

  const ToolAcceptText: Record<string, string> = {
    writeToFile: "Save",
  };

  const acceptText =
    ToolAcceptText[pendingToolApproval.tool.toolName] || "Accept";
  return (
    <div className="flex [&>button]:flex-1 [&>button]:rounded-sm gap-3 mb-2">
      <Button onClick={() => resolvePendingToolApproval(true)}>
        {acceptText}
      </Button>
      <Button
        onClick={() => resolvePendingToolApproval(false)}
        variant="secondary"
      >
        Reject
      </Button>
    </div>
  );
}
