import { prepareMessages, useIsUserInputTools } from "@/tools";
import { type Message, useChat } from "@ai-sdk/react";
import { Spinner, TextInput } from "@inkjs/ui";
import { Box, Text, useFocus } from "ink";
import Markdown from "./markdown";
import ToolBox from "./tool-box";

function Chat() {
  const { messages, handleSubmit, setInput, status, addToolResult, error } = useChat({
    api: "http://localhost:4111/api/chat/stream",
    maxSteps: 100,
    experimental_prepareRequestBody: prepareRequestBody,
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

  const showTextInput = !isLoading || isUserInputTools;

  return (
    <Box flexDirection="column">
      {status === "error" && <ErrorMessage error={error} />}
      {renderMessages.length > 0 && (
        <Box flexDirection="column" padding={1}>
          <Box flexDirection="column" gap={1}>
            {renderMessages.map((message, index) => (
              <Box key={message.id} flexDirection="column" gap={1}>
                <Box gap={1}>
                  <Text color={getRoleColor(message.role)}>
                    {message.role === "user" ? "You" : "Ragdoll"}
                  </Text>
                  {isLoading && index === renderMessages.length - 1 && (
                    <Spinner />
                  )}
                </Box>
                {message.parts.map((part, index) => {
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

      {showTextInput && (
        <UserTextInput onChange={setInput} onSubmit={() => handleSubmit()} />
      )}
    </Box>
  );
}

function ErrorMessage({
  error
}: { error?: Error }) {
  const message = error?.message || "Something went wrong";
  return (
    <Box borderStyle="round" borderColor="red" padding={1}>
      <Text color="red">{message}</Text>
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

function prepareRequestBody({
  id,
  messages,
}: { id: string; messages: Message[] }) {
  return {
    id,
    messages: prepareMessages(messages),
  };
}

export default Chat;
