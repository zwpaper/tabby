import { useOnToolCall } from "@/tools";
import { useChat } from "@ai-sdk/react";
import { Spinner, TextInput } from "@inkjs/ui";
import { Box, Text } from "ink";
import Markdown from "./markdown";
import ToolBox from "./tool-box";

function Chat() {
  const {
    onToolCall,
    pendingTool,
    confirmTool,
    pendingFollowupQuestion,
    submitAnswer,
  } = useOnToolCall();

  const { messages, handleSubmit, setInput, status } = useChat({
    api: "http://localhost:4111/api/chat/stream",
    maxSteps: 100,
    onToolCall,
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
                      pendingTool?.toolCallId;
                    const isFollowupQuestionPending =
                      part.toolInvocation.toolCallId ===
                      pendingFollowupQuestion?.toolCallId;
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

      {!isLoading && (
        <Box borderStyle="round" borderColor="white" padding={1}>
          <TextInput
            key={messages.length + 1}
            onChange={setInput}
            onSubmit={() => handleSubmit()}
            placeholder="Type your message here..."
          />
        </Box>
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

export default Chat;
