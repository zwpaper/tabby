import React, { useState, useEffect } from 'react';
import { Box, render, Text, useInput, useStdin } from 'ink';
import TextInput from 'ink-text-input';
import { useChat } from "@ai-sdk/react"

const App = () => {
	const { messages, handleSubmit, input, setInput } = useChat({
		api: "http://localhost:4111/api/agents/tabby/stream",
		maxSteps: 2,
		onToolCall: (tool) => {
			console.log(tool);
			return {
				files: ["file1.txt", "file2.txt"],
			}
		}
	})

	return (
		<Box flexDirection="column">
			{messages.map((message, index) => (
				<Box key={index}><Text>{index}: {message.content}</Text></Box>
			))}
			<TextInput value={input} onChange={setInput} onSubmit={() => handleSubmit()} />
		</Box>
	);
};

render(<App />);