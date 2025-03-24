import { useChat } from "@ai-sdk/react";
import type { ToolInvocation } from "@ai-sdk/ui-utils";
import { Box, Text, render } from "ink";
import { TextInput } from "@inkjs/ui";
import Markdown from "./components/markdown";
import { onToolCall } from "./tools";

const App = () => {
  const { messages, handleSubmit, setInput } = useChat({
    api: "http://localhost:4111/api/chat/stream",
    maxSteps: 2,
    onToolCall,
  });

  return (
    <Box flexDirection="column" padding={1}>
      {messages.length > 0 && (
        <Box flexDirection="column" gap={1}>
          {messages.map((message) => (
            <Box key={message.id} flexDirection="column" gap={1}>
              <Text color={getRoleColor(message.role)}>
                {message.role === "user" ? "You" : "Tabby"}
              </Text>
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
      )}

      <Box marginTop={1} borderStyle="round" borderColor="white" padding={1}>
        <Box>
          <TextInput
            key={messages.length + 1}
            onChange={setInput}
            onSubmit={() => handleSubmit()}
            placeholder="Type your message here..."
          />
        </Box>
      </Box>
    </Box>
  );
};

function MessageText({ text }: { text: string }) {
  return <Markdown>{text}</Markdown>;
}

function MessageToolInvocation({
  toolInvocation,
}: { toolInvocation: ToolInvocation }) {
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
          <RecordView value={toolInvocation.result} />
        )}
      </Box>
    </Box>
  );
}

function RecordView({
  value,
}: { value: Record<string, unknown> | Array<unknown> }) {
  if (!Array.isArray(value)) {
    return (
      <Box gap={1}>
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
    <Box flexDirection="column" gap={1}>
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

render(<App />);
