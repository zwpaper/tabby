import React, { useState, useEffect } from 'react';
import { Box, render, Text, useInput, useStdin } from 'ink';
import TextInput from 'ink-text-input';
import { useChat } from "@ai-sdk/react";
import type { ToolInvocation } from '@ai-sdk/ui-utils';

const App = () => {
  const { messages, handleSubmit, input, setInput } = useChat({
    api: "http://localhost:4111/api/agents/tabby/stream",
    maxSteps: 2,
    onToolCall: async (tool) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (tool.toolCall.toolName === "listFiles") {
        return {
          files: ["file1.txt", "file2.txt"],
        };
      } else {
        return {
          error: `${tool.toolCall.toolName} is not implemented`
        }
      }
    },
  });

  return (
    <Box flexDirection="column" padding={1}>
      {messages.length > 0 && <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1}>
        {messages.map((message, index) => (
          <Box key={index} marginBottom={1} flexDirection='column' gap={1}>
            {message.parts.map((part, index) => {
              if (part.type === "text") {
                return <MessageText key={index} text={part.text} role={message.role} />;
              } else if (part.type === "tool-invocation") {
                return <MessageToolInvocation key={index} toolInvocation={part.toolInvocation} />
              }
            })}
          </Box>
        ))}
      </Box>}

      <Box marginTop={1} borderStyle="round" borderColor="white" padding={1}>
        <Box>
          <TextInput
            value={input}
            onChange={setInput}
            onSubmit={() => handleSubmit()}
            placeholder='Type your message here...'
          />
        </Box>
      </Box>
    </Box>
  );
};

function MessageText({ text, role }: { text: string, role: string }) {
  return <Text color={role === "user" ? "blue" : "yellow"}>
    {role === "user" ? "You" : "Tabby"}: {text}
  </Text>
}

function MessageToolInvocation({ toolInvocation }: { toolInvocation: ToolInvocation }) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" marginLeft={1} padding={1} gap={1}>
      <Box>
        <Text color="whiteBright">{toolInvocation.toolName}( </Text>
        <RecordView value={toolInvocation.args} />
        <Text color="whiteBright"> )</Text>
      </Box>
      <Box marginLeft={1}>
        {toolInvocation.state === "result" && <RecordView value={toolInvocation.result} />}
      </Box>
    </Box>
  );
}

function RecordView({ value: args }: { value: Record<string, any> }) {
  return (
    <Box gap={1}>
      {Object.entries(args).map(([key, value], index) => (
        <Box key={index} gap={1}>
          <Text color="grey">{key}:</Text>
          <Text color="whiteBright">{JSON.stringify(value)}</Text>
        </Box>
      ))}
    </Box>
  );
}

render(<App />);