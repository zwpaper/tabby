import Markdown from "@/components/markdown";
import ToolBox from "@/components/tool-box";
import { useTokenUsage } from "@/lib/hooks/use-token-usage";
import { useWorkspaceFiles } from "@/lib/hooks/use-workspace-files";
import { prepareMessages, useIsUserInputTools } from "@/lib/tools";
import { type Message, useChat } from "@ai-sdk/react";
import { Spinner } from "@inkjs/ui";
import type { User } from "@instantdb/react";
import type { ChatRequest as RagdollChatRequest } from "@ragdoll/server";
import type { ListFilesOutputType } from "@ragdoll/tools";
import { Box, Text } from "ink";
import { useEffect, useState } from "react";
import ErrorWithRetry from "./error";
import ChatHeader from "./header";
import UserTextInput from "./user-text-input";

interface ChatProps {
  user: User;
}

function Chat({ user }: ChatProps) {
  const { tokenUsage, trackTokenUsage } = useTokenUsage();
  const workspaceFiles = useWorkspaceFiles();
  const {
    messages,
    setMessages,
    handleSubmit,
    setInput,
    status,
    addToolResult,
    error,
    reload,
  } = useChat({
    api: "http://localhost:4111/api/chat/stream",
    maxSteps: 100,
    experimental_prepareRequestBody: createPrepareRequestBody(workspaceFiles),
    headers: {
      Authorization: `Bearer ${user.refresh_token}`,
    },
    onFinish(_, { usage }) {
      trackTokenUsage(usage);
    },
  });

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

  const showTextInput = (!isLoading || isUserInputTools) && !showErrorRetry;
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

      {showTextInput && (
        <UserTextInput onChange={setInput} onSubmit={() => handleSubmit()} />
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

function createPrepareRequestBody(listFilesOutput: ListFilesOutputType) {
  const cwd = process.cwd();
  const workspace =
    "files" in listFilesOutput
      ? listFilesOutput
      : { files: [], isTruncated: false };
  return ({
    id,
    messages,
  }: { id: string; messages: Message[] }): RagdollChatRequest => {
    return {
      id,
      messages: prepareMessages(messages),
      environment: {
        currentTime: new Date().toString(),
        workspace,
        info: {
          cwd,
          shell: process.env.SHELL || "",
          os: process.platform,
          homedir: process.env.HOME || "",
        },
      },
    };
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
      id: "",
      role: "assistant",
      content: "",
      parts: [],
    });
  }

  for (let i = 0; i < x.length; i++) {
    const message = x[i];
    if (message.parts) {
      x[i] = {
        ...message,
        parts: message.parts.slice(-3),
      };
    }
  }

  return x.slice(-3);
}

export default Chat;
