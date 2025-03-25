import { useUserInteractionTools } from "@/tools";
import { type Message, useChat } from "@ai-sdk/react";
import { Spinner, TextInput } from "@inkjs/ui";
import { Box, Text, useFocus } from "ink";
import Markdown from "./markdown";
import ToolBox from "./tool-box";

function Chat() {
  const { messages, handleSubmit, setInput, status, addToolResult } = useChat({
    api: "http://localhost:4111/api/chat/stream",
    maxSteps: 100,
    experimental_prepareRequestBody: prepareRequestBody,
  });

  const { pendingFollowupQuestion } = useUserInteractionTools({ messages });
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

  const showTextInput = !isLoading || pendingFollowupQuestion;

  function onChange(value: string) {
    if (pendingFollowupQuestion) {
      return;
    }
    setInput(value);
  }

  function onSubmit(value: string) {
    if (pendingFollowupQuestion) {
      addToolResult({
        toolCallId: pendingFollowupQuestion,
        result: {
          answer: value,
        },
      });
    } else {
      handleSubmit();
    }
  }

  return (
    <Box flexDirection="column">
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
        <UserTextInput onChange={onChange} onSubmit={onSubmit} />
      )}
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
    messages: cancelPendingToolCall(messages),
  };
}

function cancelPendingToolCall(messages: Message[]) {
  return messages.map((message) => {
    if (message.role === "assistant" && message.parts) {
      for (let i = 0; i < message.parts.length; i++) {
        const part = message.parts[i];
        if (
          part.type === "tool-invocation" &&
          part.toolInvocation.state !== "result"
        ) {
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
}

export default Chat;
