import { useOnToolCall } from "@/tools";
import { useChat, type Message } from "@ai-sdk/react";
import { Spinner, TextInput } from "@inkjs/ui";
import { Box, Text, useFocus } from "ink";
import Markdown from "./markdown";
import ToolBox from "./tool-box";

function Chat() {
  const {
    onToolCall,
    pendingToolCallId,
    confirmTool,
    pendingFollowupQuestionToolCallId,
    submitAnswer,
  } = useOnToolCall();

  const { messages, handleSubmit, setInput, status } = useChat({
    api: "http://localhost:4111/api/chat/stream",
    maxSteps: 100,
    onToolCall,
    experimental_prepareRequestBody: prepareRequestBody,
  });

  const isLoading = status === "submitted" || status === "streaming";
  const renderMessages = [...messages];
  if (isLoading && messages[messages.length - 1]?.role !== "assistant") {
    renderMessages.push({
      id: "",
      role: "assistant",
      content: "",
      parts: [],
    });
  }

  function onSubmit() {
    handleSubmit();
    if (pendingToolCallId) {
      confirmTool(false, true);
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
                    const isToolPending =
                      part.toolInvocation.toolCallId ===
                      pendingToolCallId;
                    const isFollowupQuestionPending =
                      part.toolInvocation.toolCallId ===
                      pendingFollowupQuestionToolCallId;
                    return (
                      <ToolBox
                        key={index}
                        toolInvocation={part.toolInvocation}
                        confirmTool={isToolPending ? confirmTool : undefined}
                        submitAnswer={
                          isFollowupQuestionPending ? submitAnswer : undefined
                        }
                      />
                    );
                  }
                })}
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {(!isLoading || pendingToolCallId) && (
        <UserTextInput onChange={setInput} onSubmit={onSubmit} />
      )}
    </Box>
  );
}

function UserTextInput({
  onChange,
  onSubmit,
}: { onChange: (input: string) => void; onSubmit: () => void }) {
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

function prepareRequestBody({ id, messages }: { id: string, messages: Message[] }) {
  return {
    id,
    messages: cancelPendingToolCall(messages),
  };
}

function cancelPendingToolCall(messages: Message[]) {
  return messages.map((message) => {
    if (message.role === "assistant" && message.parts) {
      message.parts?.forEach((part) => {
        if (part.type === "tool-invocation" && part.toolInvocation.state !== "result") {
          part.toolInvocation = {
            ...part.toolInvocation,
            state: "result",
            result: {
              error: "User cancelled the tool call.",
            }
          }
        }
      });
    }
    return message;
  });
}

export default Chat;
