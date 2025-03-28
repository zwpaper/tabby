import { prepareMessages, useIsUserInputTools } from "@/tools";
import { listFiles } from "@/tools/list-files";
import { type Message, useChat } from "@ai-sdk/react";
import { ConfirmInput, Spinner, TextInput } from "@inkjs/ui";
import type { ChatRequest as RagdollChatRequest } from "@ragdoll/server";
import type { ListFilesOutputType } from "@ragdoll/tools";
import { Box, Text, useFocus } from "ink";
import { useEffect, useState } from "react";
import Markdown from "./markdown";
import ToolBox from "./tool-box";

function Chat() {
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
  });

  const { isUserInputTools } = useIsUserInputTools({ messages });
  const isLoading = status === "submitted" || status === "streaming";

  const renderMessages = [...messages];
  if (isLoading && messages[messages.length - 1]?.role !== "assistant") {
    // Add a placeholder message to show the spinner
    renderMessages.push({
      id: "",
      role: "assistant",
      content: "",
      parts: [],
    });
  }

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
      {renderMessages.length > 0 && (
        <Box flexDirection="column" padding={1}>
          <Box flexDirection="column" gap={1}>
            {renderMessages.slice(-3).map((message, index) => (
              <Box key={message.id} flexDirection="column" gap={1}>
                <Box gap={1}>
                  <Text color={getRoleColor(message.role)}>
                    {message.role === "user" ? "You" : "Ragdoll"}
                  </Text>
                  {isLoading && index === renderMessages.length - 1 && (
                    <Spinner />
                  )}
                </Box>
                {message.parts.slice(-3).map((part, index) => {
                  if (part.type === "text") {
                    return <Markdown key={index}>{part.text}</Markdown>;
                  }
                  if (part.type === "tool-invocation") {
                    return (
                      <ToolBox
                        key={index}
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

function ErrorWithRetry({
  error,
  reload,
  onCancel,
}: { error?: Error; reload: () => Promise<unknown>; onCancel: () => void }) {
  return (
    <Box
      borderStyle="round"
      borderColor="red"
      padding={1}
      gap={1}
      flexDirection="column"
    >
      <Text color="red">{error?.message}</Text>
      <Box>
        <Text color="grey">Retry? </Text>
        <ConfirmInput onConfirm={reload} onCancel={onCancel} />
      </Box>
    </Box>
  );
}

function UserTextInput({
  onChange,
  onSubmit,
}: { onChange: (input: string) => void; onSubmit: (input: string) => void }) {
  const { isFocused } = useFocus({ autoFocus: true });
  const borderColor = isFocused ? "white" : "gray";
  return (
    <Box borderStyle="round" borderColor={borderColor} padding={1}>
      <TextInput
        isDisabled={!isFocused}
        onChange={onChange}
        onSubmit={onSubmit}
        placeholder="Type your message here..."
      />
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
  const workspaceFiles =
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
        workspace: {
          ...workspaceFiles,
          cwd,
        },
        info: {
          shell: process.env.SHELL || "",
          os: process.platform,
          homedir: process.env.HOME || "",
        },
      },
    };
  };
}

function useWorkspaceFiles() {
  const [workspaceFiles, setWorkspaceFiles] = useState<ListFilesOutputType>({
    files: [],
    isTruncated: false,
  });
  useEffect(() => {
    const handle = setInterval(async () => {
      const x = await listFiles({ path: ".", recursive: true });
      setWorkspaceFiles(x);
    }, 5000);
    return () => clearInterval(handle);
  }, []);
  return workspaceFiles;
}

export default Chat;
