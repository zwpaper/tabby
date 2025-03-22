import React, { useState, useEffect } from 'react';
import { Box, render, Text, useInput, useStdin } from 'ink';
import TextInput from 'ink-text-input';
import { useChat } from "@ai-sdk/react"
import { createOnToolCall } from "@ragdoll/client-tools"

const App = () => {
	const { messages, handleSubmit, input, setInput } = useChat({
		api: "http://localhost:4111/api/agents/tabby/stream",
		onToolCall: createOnToolCall({}),
	})

	return (
		<Box flexDirection="column">
			{messages.map((message, index) => (
				<Box key={index}><Text>{message.content}</Text></Box>
			))}
			<TextInput value={input} onChange={setInput} onSubmit={() => handleSubmit()} />
		</Box>
	);
};

render(<App />);