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
      return {
        files: ["file1.txt", "file2.txt"],
      };
    },
  });

  return (
    <Box flexDirection="column" padding={1}>
      {messages.length > 0 && <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1}>
        {messages.map((message, index) => (
          <Box key={index} marginBottom={1} flexDirection='column'>
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

      <Box marginTop={1}>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={() => handleSubmit()}
          placeholder="Type your message here..."
        />
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
    <Box flexDirection="column" borderStyle="round" borderColor="green" paddingLeft={2}>
      <Text color="green">State: {toolInvocation.state}</Text>
      <Text>{JSON.stringify(toolInvocation)}</Text>
    </Box>
  );
}

render(<App />);