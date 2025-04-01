import { Box, Text } from "ink";
import React, { useState } from "react";
import UserTextInput from "../user-text-input"; // Adjusted import path

// Wrapper component to manage state and provide context for the UserTextInput
const UserTextInputWrapper: React.FC<{}> = () => {
  const [value, setValue] = useState("");
  const [submittedValue, setSubmittedValue] = useState("");

  const onSubmit = (submittedVal: string) => {
    // Check if it's a command that was handled internally (like /logout)
    // In a real scenario, the component might clear itself or handle submission differently.
    // For the story, we'll just display what was submitted.
    if (submittedVal !== "") {
      // Avoid setting empty submitted value if logout clears it
      setSubmittedValue(submittedVal);
    }
    // Don't clear the input here automatically, UserTextInput handles its own clearing logic
    // setValue(""); // Let the component manage its internal state clearing
  };

  const onChange = (currentValue: string) => {
    setValue(currentValue);
    // Reset submitted value when input changes
    if (submittedValue) {
      setSubmittedValue("");
    }
  };

  return (
    // Provide the mock contexts
    <Box flexDirection="column">
      <UserTextInput
        onChange={onChange}
        onSubmit={onSubmit}
        onLogout={() => {}}
        onClearHistory={() => {}} // Add dummy onClearHistory prop
      />
      <Box marginTop={1}>
        <Text>Current Value: {value}</Text>
      </Box>
      <Box>
        <Text>Submitted Value: {submittedValue}</Text>
      </Box>
    </Box>
  );
};

const storyExport = {
  stories: [
    {
      id: "userTextInputDefault",
      title: "User Text Input (Default)",
      component: <UserTextInputWrapper />,
    },
  ],
  meta: {
    group: "Components/Chat", // Group under Chat components
    // Adjust order as needed relative to other components
    order: 1, // Example order
  },
};

export default storyExport;
