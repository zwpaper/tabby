import { ConfirmPrompt } from "@/components/confirm-prompt";
import Markdown from "@/components/markdown";
import ToolBox from "@/components/tool-box";
import type { ToolProps } from "@/components/tool-box/types";
import { apiClient } from "@/lib/api";
import { useAppConfig } from "@/lib/app-config";
import { useAuth } from "@/lib/auth";
import { useEnvironment } from "@/lib/hooks/use-environment";
import { useRunningToolCall } from "@/lib/hooks/use-running-tool-call"; // Added import
import { useStdoutDimensions } from "@/lib/hooks/use-stdout-dimensions";
import { useTokenUsage } from "@/lib/hooks/use-token-usage";
import { useRouter } from "@/lib/router";
import { useLocalSettings } from "@/lib/storage";
import { type Message, type UseChatHelpers, useChat } from "@ai-sdk/react";
import { Spinner } from "@inkjs/ui";
import type {
  Environment,
  ChatRequest as RagdollChatRequest,
  UserEvent,
} from "@ragdoll/server";
import { fromUIMessage, toUIMessages } from "@ragdoll/server/message-utils";
import { isAutoInjectTool } from "@ragdoll/tools";
import { useQuery } from "@tanstack/react-query";
import { Box, Text } from "ink";
import {
  type MutableRefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import ErrorWithRetry from "./components/error";
import ChatHeader from "./components/header";
import UserTextInput from "./components/user-text-input";

export default function ChatPage({
  initialTaskId,
  event,
}: { initialTaskId?: number; event?: UserEvent }) {
  const taskId = useRef(initialTaskId);
  const { back } = useRouter();
  const appConfig = useAppConfig();

  const { data, isLoading, refetch } = useQuery({
    refetchInterval: appConfig.listen ? 5000 : false,
    queryKey: ["task", taskId.current],
    queryFn: async () => {
      if (!taskId.current) {
        throw new Error("Task ID is undefined");
      }

      const res = await apiClient.api.tasks[":id"].$get({
        param: { id: taskId.current.toString() },
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch task: ${res.statusText}`);
      }
      return res.json();
    },
    enabled: taskId.current !== undefined,
  });

  const messageLength = data?.conversation?.messages.length || 0;

  useEffect(() => {
    if (
      appConfig.listen &&
      data &&
      messageLength > 0 &&
      ["completed", "pending-input", "failed"].includes(data.status)
    ) {
      back();
    }
  }, [data, data?.status, messageLength, back, appConfig.listen]);

  // Display loading spinner while task is loading
  if (initialTaskId !== undefined && isLoading) {
    return (
      <Box
        flexDirection="column"
        width="100%"
        height="100%"
        justifyContent="center"
        alignItems="center"
      >
        <Spinner label="Loading task..." />
      </Box>
    );
  }

  const initialMessages = toUIMessages(data?.conversation?.messages || []);
  const onTaskCreated = useCallback(() => {
    refetch();
  }, [refetch]);
  return (
    <ChatUI
      onTaskCreated={onTaskCreated}
      taskId={taskId}
      event={event}
      initialMessages={initialMessages}
    />
  );
}

function ChatUI({
  event,
  taskId,
  initialMessages,
  onTaskCreated,
}: {
  event?: UserEvent;
  taskId: MutableRefObject<number | undefined>;
  initialMessages?: Message[];
  onTaskCreated: () => void;
}) {
  const { data: authData, logout } = useAuth();
  if (!authData) {
    return <Text>Please log in to use the chat.</Text>;
  }

  const [{ model }] = useLocalSettings();
  const appConfig = useAppConfig();
  const { tokenUsage, trackTokenUsage } = useTokenUsage();
  const { environment, reload: reloadEnvironment } = useEnvironment(
    appConfig.customRuleFiles,
  );
  const { initialPromptSent } = useRouter();

  const {
    messages,
    setMessages,
    handleSubmit,
    setInput,
    status,
    addToolResult,
    stop,
    error,
    data,
    reload,
    append,
  } = useChat({
    initialInput: appConfig.prompt,
    api: apiClient.api.chat.stream.$url().toString(),
    maxSteps: 100,
    initialMessages,
    // Pass a function that calls prepareRequestBody with the current environment
    experimental_prepareRequestBody: (request) =>
      prepareRequestBody(
        taskId.current,
        event,
        model,
        appConfig.tools,
        request,
        environment.current,
      ),
    headers: {
      Authorization: `Bearer ${authData.session.token}`,
    },
    onResponse(response) {
      if (response.status === 401) {
        logout();
      }
    },
    onFinish(_, { finishReason, usage }) {
      if (finishReason === "unknown") {
        // Ignore unknown finish reasons
        return;
      }

      trackTokenUsage(usage);
    },
  });

  useEffect(() => {
    if (
      taskId.current === undefined &&
      typeof data?.[0] === "object" &&
      data[0] &&
      "id" in data[0] &&
      typeof data[0].id === "number"
    ) {
      taskId.current = data[0].id;
      onTaskCreated();
    }
  }, [taskId, data, onTaskCreated]);

  const onChange = (value: string) => {
    setInput(value);
  };

  const onSubmit = useCallback(async () => {
    await reloadEnvironment();
    handleSubmit();
  }, [handleSubmit, reloadEnvironment]);

  // Always use the latest addToolResult function as it captures the latest state.
  const latestAddToolResult = useRef(addToolResult);
  useEffect(() => {
    latestAddToolResult.current = addToolResult;
  }, [addToolResult]);

  const hookAddToolResult = useCallback(
    async (...args: Parameters<typeof addToolResult>) => {
      await reloadEnvironment();
      latestAddToolResult.current(...args);
    },
    [reloadEnvironment],
  );

  // Handle initial prompt
  useEffect(() => {
    if (appConfig.prompt && !initialPromptSent.current) {
      initialPromptSent.current = true;
      onSubmit();
    }
  }, [appConfig.prompt, onSubmit, initialPromptSent]);

  // Use the custom hook for tool call logic
  const { runningToolCall, onToolCall, abortToolCall } =
    useRunningToolCall(hookAddToolResult);

  const isLoading = status === "submitted" || status === "streaming";

  const renderMessages = createRenderMessages(messages, isLoading);

  const [errorRef, setErrorRef] = useState<typeof error>();
  useEffect(() => {
    setErrorRef(error);
  }, [error]);

  async function onRetryAccept() {
    setErrorRef(undefined);
    await reloadWithAssistantMessage({
      messages,
      setMessages,
      append,
      reload,
    });
  }

  function onRetryCancel() {
    setErrorRef(undefined);
  }

  // Function to clear message history
  function handleClearHistory() {
    setMessages(Array.from([]));
  }

  const showRenderMessages = true;
  const showChatHeader = true;

  // Show text input only if not loading OR user input tools are active,
  // AND environment is loaded, AND no error retry is shown
  const showTextInput =
    environment && !isLoading && !runningToolCall && !errorRef;

  const [showAbortRequest, setShowAbortRequest] = useState(false);
  useEffect(() => {
    if (status === "streaming") {
      const timeoutId = setTimeout(() => {
        setShowAbortRequest(true);
      }, 1000);
      return () => clearTimeout(timeoutId);
    }

    setShowAbortRequest(false);
  }, [status]);

  const [_, height] = useStdoutDimensions();

  const [scrollY, setScrollY] = useState(1);
  // Reset scroll when new messages are rendered
  useEffect(() => {
    setScrollY(status && 1);
  }, [status]);

  function onScroll(step: number) {
    if (appConfig.fullscreen) {
      setScrollY((prev) => Math.min(prev + step, 1));
    }
  }
  return (
    <Box flexDirection="column" padding={1} height="100%" width="100%">
      {showRenderMessages && (
        <Box
          height={appConfig.fullscreen ? height - 20 : undefined}
          flexGrow={1}
          flexDirection="column"
          justifyContent="flex-end"
          gap={1}
          overflow="hidden"
          marginBottom={scrollY}
        >
          {renderMessages.map((message, messageIdx) => (
            <Box key={message.id} flexDirection="column" gap={1} flexShrink={0}>
              <Box gap={1}>
                <Text color={getRoleColor(message.role)}>
                  {message.role === "user" ? "You" : "Pochi"}
                </Text>
                {isLoading &&
                  message.id ===
                    renderMessages[renderMessages.length - 1].id && <Spinner />}
              </Box>
              {message.parts?.map((part, index) => {
                if (part.type === "text") {
                  return <Markdown key={index}>{part.text}</Markdown>;
                }
                if (part.type === "tool-invocation") {
                  if (isAutoInjectTool(part.toolInvocation.toolName)) {
                    return (
                      <AutoInjectTool
                        key={part.toolInvocation.toolCallId}
                        toolCall={part.toolInvocation}
                        onToolCall={onToolCall}
                      />
                    );
                  }

                  return (
                    <ToolBox
                      key={part.toolInvocation.toolCallId}
                      toolCall={part.toolInvocation}
                      runningToolCall={runningToolCall}
                      onToolCall={onToolCall}
                      abortToolCall={abortToolCall}
                      disallowApproval={messageIdx < messages.length - 1}
                    />
                  );
                }
              })}
            </Box>
          ))}
        </Box>
      )}

      {errorRef && (
        <ErrorWithRetry
          isLoading={isLoading}
          error={errorRef}
          onRetry={onRetryAccept}
          onCancel={onRetryCancel}
        />
      )}

      {/* Show loading indicator if environment is not yet loaded */}
      {!environment && !error && status !== "ready" && (
        <Box padding={1}>
          <Text>Loading environment...</Text>
        </Box>
      )}

      {showChatHeader && (
        <ChatHeader
          status={status}
          user={authData.user}
          tokenUsage={tokenUsage}
        />
      )}

      {/* Show text input only when ready */}
      {showTextInput ? (
        <UserTextInput
          onLogout={logout}
          onChange={onChange}
          onSubmit={onSubmit}
          onClearHistory={handleClearHistory} // Pass the handler
          onScroll={onScroll} // Pass the scroll function
        />
      ) : (
        <Box minHeight={5} alignItems="center">
          {showAbortRequest && (
            <ConfirmPrompt
              prompt="Abort current request?"
              confirm={(result) => result && stop()}
            />
          )}
        </Box>
      )}
    </Box>
  );
}

function AutoInjectTool({
  toolCall,
  onToolCall,
}: ToolProps & {
  onToolCall: (toolCall: ToolProps["toolCall"], approved: boolean) => void;
}) {
  const rejected = useRef(false);
  useEffect(() => {
    if (!rejected.current) {
      rejected.current = true;
      onToolCall(toolCall, false);
    }
  }, [toolCall, onToolCall]);
  return null;
}

function getRoleColor(role: string) {
  if (role === "user") {
    return "blue";
  }
  return "yellow";
}

// This function now directly prepares the body when called by useChat
function prepareRequestBody(
  taskId: number | undefined,
  event: UserEvent | undefined,
  model: string,
  tools: string[],
  request: { messages: Message[] },
  environment: Environment | null,
): RagdollChatRequest | null {
  if (!environment) {
    // Handle the case where environment is not loaded.
    // Returning null might cause issues depending on how useChat handles it.
    // Log an error for debugging. useChat might need adjustments if null is problematic.
    console.error("Environment not loaded, cannot prepare request body.");
    // Returning null might break useChat, consider throwing or returning a dummy request
    // For now, let's return null and see if useChat handles it gracefully.
    // If not, we might need to prevent submission earlier or throw an error.
    return null;
  }

  return {
    id: taskId ? taskId.toString() : undefined,
    event,
    message: fromUIMessage(request.messages[request.messages.length - 1]),
    tools,
    model,
    environment, // Use the loaded environment
  };
}

/**
 * Keep only the last 3 messages from the assistant.
 *
 * For tools, we also keep only last 3 invocations.
 */
function createRenderMessages(messages: Message[], isLoading: boolean) {
  const x = [...messages];

  if (isLoading && messages[messages.length - 1]?.role !== "assistant") {
    // Add a placeholder message to show the spinner
    x.push({
      id: "", // Consider using a unique temporary ID if needed
      role: "assistant",
      content: "",
      parts: [],
    });
  }
  return x;
}

async function reloadWithAssistantMessage({
  messages,
  append,
  setMessages,
  reload,
}: {
  messages: Message[];
  append: UseChatHelpers["append"];
  setMessages: UseChatHelpers["setMessages"];
  reload: UseChatHelpers["reload"];
}) {
  if (messages.length === 0) {
    return;
  }

  const lastMessage = messages[messages.length - 1];
  if (lastMessage.role === "assistant") {
    const lastPart = lastMessage.parts?.[lastMessage.parts.length - 1];
    if (
      lastPart &&
      lastPart.type === "tool-invocation" &&
      lastPart.toolInvocation.state === "result"
    ) {
      setMessages(messages.slice(0, -1));
      return await append(lastMessage);
    }
  }

  return await reload();
}
