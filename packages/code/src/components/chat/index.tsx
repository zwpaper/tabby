import Markdown from "@/components/markdown";
import ToolBox from "@/components/tool-box";
import { useAppConfig } from "@/lib/app-config";
import { useAuth } from "@/lib/auth";
import { useEnvironment } from "@/lib/hooks/use-environment";
import { useTokenUsage } from "@/lib/hooks/use-token-usage";
import { prepareMessages, useIsUserInputTools } from "@/lib/tools";
import { type Message, useChat } from "@ai-sdk/react";
import { Spinner } from "@inkjs/ui";
import type {
  Environment,
  ChatRequest as RagdollChatRequest,
} from "@ragdoll/server";
import { Box, Text } from "ink";
import { useEffect, useState } from "react";
import ErrorWithRetry from "./error";
import ChatHeader from "./header";
import UserTextInput from "./user-text-input";

function Chat() {
  const { user, logout } = useAuth();
  if (!user) {
    return <Text>Please log in to use the chat.</Text>;
  }

  const appConfig = useAppConfig();
  const { tokenUsage, trackTokenUsage } = useTokenUsage();
  const environment = useEnvironment();
  const {
    messages,
    setMessages,
    handleSubmit,
    setInput,
    status,
    addToolResult,
    error,
    reload,
    append,
  } = useChat({
    api: appConfig.dev
      ? "http://localhost:4111/api/chat/stream"
      : "https://ragdoll-production.up.railway.app/api/chat/stream",
    maxSteps: 100,
    // Pass a function that calls prepareRequestBody with the current environment
    experimental_prepareRequestBody: (request) =>
      prepareRequestBody(request, environment), // Updated call
    headers: {
      Authorization: `Bearer ${user.refresh_token}`,
    },
    onFinish(_, { usage }) {
      trackTokenUsage(usage);
    },
  });

  const onChange = (value: string) => {
    setInput(value);
  };

  const onSubmit = () => {
    if (environment) {
      handleSubmit();
    }
  };

  const [initialPromptSent, setInitialPromptSent] = useState(false);
  // Handle initial prompt
  useEffect(() => {
    if (appConfig.prompt && environment && !initialPromptSent) {
      setInitialPromptSent(true);
      append({
        role: "user",
        content: appConfig.prompt,
      });
    }
  }, [appConfig.prompt, environment, initialPromptSent, append]);

  const { isUserInputTools } = useIsUserInputTools({ messages });
  const isLoading = status === "submitted" || status === "streaming";

  const renderMessages = createRenderMessages(messages, isLoading);

  const [showErrorRetry, setShowErrorRetry] = useState(false);
  useEffect(() => {
    if (status === "error") {
      setShowErrorRetry(true);
    }
  }, [status]);
  function onRetryCancel() {
    setShowErrorRetry(false);
    setMessages(messages.slice(0, -1));
  }

  // Function to clear message history
  function handleClearHistory() {
    setMessages([]);
  }

  // Show text input only if not loading OR user input tools are active,
  // AND environment is loaded, AND no error retry is shown
  const showTextInput =
    (!isLoading || isUserInputTools) && environment && !showErrorRetry;

  return (
    <Box flexDirection="column">
      <ChatHeader user={user} tokenUsage={tokenUsage} />

      {renderMessages.length > 0 && (
        <Box flexDirection="column" padding={1}>
          <Box flexDirection="column" gap={1}>
            {renderMessages.map((message) => (
              <Box key={message.id} flexDirection="column" gap={1}>
                <Box gap={1}>
                  <Text color={getRoleColor(message.role)}>
                    {message.role === "user" ? "You" : "Ragdoll"}
                  </Text>
                  {isLoading &&
                    message.id ===
                      renderMessages[renderMessages.length - 1].id && (
                      <Spinner />
                    )}
                </Box>
                {message.parts?.map((part, index) => {
                  if (part.type === "text") {
                    return <Markdown key={index}>{part.text}</Markdown>;
                  }
                  if (part.type === "tool-invocation") {
                    return (
                      <ToolBox
                        key={part.toolInvocation.toolCallId}
                        toolCall={part.toolInvocation}
                        addToolResult={addToolResult}
                      />
                    );
                  }
                })}
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {error && showErrorRetry && (
        <ErrorWithRetry
          error={error}
          reload={reload}
          onCancel={onRetryCancel}
        />
      )}

      {/* Show loading indicator if environment is not yet loaded */}
      {!environment && !error && status !== "ready" && (
        <Box padding={1}>
          <Text>Loading environment...</Text>
        </Box>
      )}

      {/* Show text input only when ready */}
      {showTextInput && (
        <UserTextInput
          onLogout={logout}
          onChange={onChange}
          onSubmit={onSubmit}
          onClearHistory={handleClearHistory} // Pass the handler
        />
      )}
    </Box>
  );
}

function getRoleColor(role: string) {
  if (role === "user") {
    return "blue";
  }
  return "yellow";
}

// This function now directly prepares the body when called by useChat
function prepareRequestBody(
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

  // Limit parts per message (optional, kept from original)
  for (let i = 0; i < x.length; i++) {
    const message = x[i];
    if (message.parts) {
      x[i] = {
        ...message,
        parts: message.parts.slice(-3), // Keep last 3 parts
      };
    }
  }

  // Limit total messages displayed
  return x.slice(-3); // Keep last 3 messages
}

export default Chat;
