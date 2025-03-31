import React, { useState } from "react";
import TextInput from "../text-input"; // Adjust the import path as needed
import { Box, Text } from "ink";

// Wrapper component to manage state for the TextInput
const TextInputWrapper: React.FC<{
  initialValue?: string;
  placeholder?: string;
}> = ({ initialValue = "", placeholder = "" }) => {
  const [value, setValue] = useState(initialValue);
  const [submittedValue, setSubmittedValue] = useState("");

  const onSubmit = (value: string) => {
    setSubmittedValue(value);
    setValue(""); // Clear the input after submission
  }

  return (
    <Box flexDirection="column">
      <TextInput
        value={value}
        onChange={setValue}
        placeholder={placeholder}
        onSubmit={onSubmit}
      />
      <Box marginTop={1}>
        <Text>Submitted Value: {submittedValue}</Text>
      </Box>
    </Box>
  );
};

const storyExport = {
  stories: [
    {
      id: "textInputDefault",
      title: "Text Input (Placeholder)",
      component: <TextInputWrapper placeholder="Enter text here..." />,
    },
    {
      id: "textInputWithValue",
      title: "Text Input (With Value)",
      component: <TextInputWrapper initialValue="Initial value" />,
    },
  ],
  meta: {
    group: "Components",
    // Adjust order as needed relative to other components
    order: 4, // Assuming it comes after Email Login
  },
};

export default storyExport;
