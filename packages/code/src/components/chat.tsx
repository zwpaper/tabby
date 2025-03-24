import { type UseChatOptions, useChat } from "@ai-sdk/react";
import type { ToolInvocation } from "@ai-sdk/ui-utils";
import { Spinner } from "@inkjs/ui";
import { TextInput } from "@inkjs/ui";
import { Box, Text } from "ink";
import Markdown from "./markdown";

function Chat({ onToolCall }: { onToolCall: UseChatOptions["onToolCall"] }) {
  const { messages, handleSubmit, setInput, status } = useChat({
    api: "http://localhost:4111/api/chat/stream",
    maxSteps: 2,
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
                    {message.role === "user" ? "You" : "Tabby"}
                  </Text>
                  {isLoading && index === renderMessages.length - 1 && (
                    <Spinner />
                  )}
                </Box>
                {message.parts.map((part, index) => {
                  if (part.type === "text") {
                    return <MessageText key={index} text={part.text} />;
                  }
                  if (part.type === "tool-invocation") {
                    return (
                      <MessageToolInvocation
                        key={index}
                        toolInvocation={part.toolInvocation}
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

function MessageText({ text }: { text: string }) {
  return <Markdown>{text}</Markdown>;
}

function MessageToolInvocation({
  toolInvocation,
}: {
  toolInvocation: ToolInvocation;
}) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="grey"
      marginLeft={1}
      padding={1}
      gap={1}
    >
      <Box>
        <Text color="whiteBright">{toolInvocation.toolName}( </Text>
        <RecordView value={toolInvocation.args} />
        <Text color="whiteBright"> )</Text>
      </Box>
      <Box marginLeft={1}>
        {toolInvocation.state === "result" && (
          <RecordView value={toolInvocation.result} flexDirection="column" />
        )}
      </Box>
    </Box>
  );
}

function RecordView({
  value,
  flexDirection,
}: {
  value: Record<string, unknown> | Array<unknown>;
  flexDirection?: "row" | "column";
}) {
  if (!Array.isArray(value)) {
    return (
      <Box gap={1} flexDirection={flexDirection}>
        {Object.entries(value).map(([key, value]) => (
          <Box key={key} gap={1}>
            <Text color="grey">{key}:</Text>
            <Text color="whiteBright">{JSON.stringify(value)}</Text>
          </Box>
        ))}
      </Box>
    );
  }
  return (
    <Box gap={1} flexDirection={flexDirection}>
      {value.map((item, index) => (
        <Box key={index} gap={1}>
          <Text color="grey">{index}:</Text>
          <Text color="whiteBright">{JSON.stringify(item)}</Text>
        </Box>
      ))}
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
