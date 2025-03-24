import { useOnToolCall } from "@/tools";
import { useChat } from "@ai-sdk/react";
import type { ToolInvocation } from "@ai-sdk/ui-utils";
import { ConfirmInput, Spinner, TextInput } from "@inkjs/ui";
import { Box, Text } from "ink";
import Markdown from "./markdown";

function Chat() {
  const { onToolCall, pendingTool, confirmTool } = useOnToolCall();

  const { messages, handleSubmit, setInput, status } = useChat({
    api: "http://localhost:4111/api/chat/stream",
    maxSteps: 5,
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
                    return <MessageText key={index} text={part.text} />;
                  }
                  if (part.type === "tool-invocation") {
                    const isToolPending =
                      part.toolInvocation.toolCallId ===
                      pendingTool?.toolCallId;
                    return (
                      <MessageToolInvocation
                        key={index}
                        toolInvocation={part.toolInvocation}
                      >
                        {isToolPending && (
                          <ConfirmToolUsage confirm={confirmTool} />
                        )}
                      </MessageToolInvocation>
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

function ConfirmToolUsage({
  confirm,
}: { confirm: (approved: boolean) => void }) {
  return (
    <Box>
      <Text color="whiteBright">Allow this tool to run? </Text>
      <ConfirmInput
        onConfirm={() => confirm(true)}
        onCancel={() => confirm(false)}
      />
    </Box>
  );
}

function MessageTaskComplete({
  result,
  command,
}: { result: string; command?: string }) {
  return (
    <Box
      flexDirection="column"
      marginLeft={1}
      borderStyle="round"
      borderColor="green"
      padding={1}
      gap={1}
    >
      <Text color="greenBright">Task Complete</Text>
      <MessageText text={result} />
      {command && <Text>Please use `{command}` to check the result.</Text>}
    </Box>
  );
}

function MessageText({ text }: { text: string }) {
  return <Markdown>{text}</Markdown>;
}

function MessageToolInvocation({
  toolInvocation,
  children,
}: {
  toolInvocation: ToolInvocation;
  children?: React.ReactNode;
}) {
  if (toolInvocation.toolName === "attemptCompletion") {
    return (
      <MessageTaskComplete
        result={toolInvocation.args.result}
        command={toolInvocation.args.command}
      />
    );
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="grey"
      marginLeft={1}
      padding={1}
      gap={1}
    >
      <ToolCall name={toolInvocation.toolName} args={toolInvocation.args} />
      {children}
      {toolInvocation.state === "result" && toolInvocation.result && (
        <Box marginLeft={1}>
          <Record value={toolInvocation.result} flexDirection="column" />
        </Box>
      )}
    </Box>
  );
}

// biome-ignore lint/suspicious/noExplicitAny: args are dynamic
function ToolCall({ name, args }: { name: string; args: any }) {
  return (
    <Box>
      <Text color="whiteBright">{name}( </Text>
      <Record value={args} />
      <Text color="whiteBright"> )</Text>
    </Box>
  );
}

function Record({
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
