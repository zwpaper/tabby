import { ConfirmPrompt } from "@/components/confirm-prompt";
import Markdown from "@/components/markdown";
import ToolBox from "@/components/tool-box";
import type { ToolProps } from "@/components/tool-box/types";
import { useApiClient } from "@/lib/api";
import { useAppConfig } from "@/lib/app-config";
import { useAuth } from "@/lib/auth";
import { useEnvironment } from "@/lib/hooks/use-environment";
import { useRunningToolCall } from "@/lib/hooks/use-running-tool-call"; // Added import
import { useStdoutDimensions } from "@/lib/hooks/use-stdout-dimensions";
import { useTokenUsage } from "@/lib/hooks/use-token-usage";
import { useLocalSettings } from "@/lib/storage";
import { prepareMessages } from "@/lib/tools";
import { type Message, type UseChatHelpers, useChat } from "@ai-sdk/react";
import { Spinner } from "@inkjs/ui";
import type {
  Environment,
  ChatRequest as RagdollChatRequest,
} from "@ragdoll/server";
import { Box, Text } from "ink";
import { useCallback, useEffect, useRef, useState } from "react";
import ErrorWithRetry from "./components/error";
import ChatHeader from "./components/header";
import SettingsModal from "./components/settings-modal";
import UserTextInput from "./components/user-text-input";

function ChatPage() {
  const { data, logout } = useAuth();
  if (!data) {
    return <Text>Please log in to use the chat.</Text>;
  }

  const [{ model }] = useLocalSettings();
  const appConfig = useAppConfig();
  const { tokenUsage, trackTokenUsage } = useTokenUsage();
  const { environment, reload: reloadEnvironment } = useEnvironment(
    appConfig.customRuleFiles,
  );
  const {
    messages,
    setMessages,
    handleSubmit,
    setInput,
    status,
    addToolResult,
    stop,
    error,
    reload,
    append,
  } = useChat({
    api: useApiClient().api.chat.stream.$url().toString(),
    maxSteps: 100,
    // Pass a function that calls prepareRequestBody with the current environment
    experimental_prepareRequestBody: (request) =>
      prepareRequestBody(model, request, environment.current), // Updated call
    headers: {
      Authorization: `Bearer ${data.session.token}`,
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

  const onChange = (value: string) => {
    setInput(value);
  };

  const onSubmit = async () => {
    await reloadEnvironment();
    handleSubmit();
  };

  const hookAddToolResult = useCallback(
    async (...args: Parameters<typeof addToolResult>) => {
      await reloadEnvironment();
      addToolResult(...args);
    },
    [addToolResult, reloadEnvironment],
  );

  const [initialPromptSent, setInitialPromptSent] = useState(false);
  const [showSettings, setShowSettings] = useState(false); // State for settings dialog

  // Use the custom hook for tool call logic
  const { runningToolCall, onToolCall, abortToolCall } =
    useRunningToolCall(hookAddToolResult);

  // Handle initial prompt
  useEffect(() => {
    if (appConfig.prompt && environment.current && !initialPromptSent) {
      setInitialPromptSent(true);
      append({
        role: "user",
        content: appConfig.prompt,
      });
    }
  }, [appConfig.prompt, environment.current, initialPromptSent, append]);

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

  // Function to toggle settings dialog
  function handleOpenSettings() {
    setShowSettings((prev) => !prev);
  }

  const showRenderMessages = !showSettings;
  const showChatHeader = !showSettings;

  // Show text input only if not loading OR user input tools are active,
  // AND environment is loaded, AND no error retry is shown
  const showTextInput =
    !showSettings && environment && !isLoading && !runningToolCall && !errorRef;

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
          marginBottom={1}
        >
          {renderMessages.map((message) => (
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
                  // readEnvironment is a special tool that is handled by server side, but sometimes LLM might wrongly call it.
                  // Here we can simply ignore it.
                  if (part.toolInvocation.toolName === "readEnvironment") {
                    return (
                      <ReadEnvironment
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
        <ChatHeader status={status} user={data.user} tokenUsage={tokenUsage} />
      )}

      {/* Show text input only when ready */}
      {showTextInput ? (
        <UserTextInput
          onLogout={logout}
          onChange={onChange}
          onSubmit={onSubmit}
          onClearHistory={handleClearHistory} // Pass the handler
          onOpenSettings={handleOpenSettings} // Pass the settings handler
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

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </Box>
  );
}

function ReadEnvironment({
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
  model: string,
  request: { id: string; messages: Message[] },
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
    id: request.id,
    messages: prepareMessages(request.messages),
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

  if (x.length > 5) {
    x.splice(0, x.length - 5);
  }

  for (const [i, message] of x.entries()) {
    if (message.parts) {
      const parts = [...message.parts];
      if (parts.length > 5) {
        parts.splice(0, parts.length - 5);
      }
      x[i] = {
        ...message,
        parts,
      };
    }
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

export default ChatPage;
