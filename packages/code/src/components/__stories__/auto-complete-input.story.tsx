import { Box, Text } from "ink";
import React, { useState } from "react";
import AutoCompleteInput from "../auto-complete-input";
import type { AutoCompleteInputProps } from "../auto-complete-input";

// Wrapper component to manage state for the story
const AutoCompleteStoryWrapper: React.FC<AutoCompleteInputProps> = ({
  placeholder,
  suggestions,
}) => {
  const [submittedValue, setSubmittedValue] = useState<string | null>(null);

  const handleSubmit = (value: string) => {
    setSubmittedValue(value);
  };

  return (
    <Box flexDirection="column">
      <Text>Enter text and press Enter. Type '@' to see suggestions.</Text>
      <AutoCompleteInput
        placeholder={placeholder}
        suggestions={suggestions}
        onSubmit={handleSubmit} // Pass the submit handler
      />
      {submittedValue !== null && (
        <Box marginTop={1}>
          <Text>Submitted: {submittedValue}</Text>
        </Box>
      )}
    </Box>
  );
};

const storyExport = {
  stories: [
    {
      id: "default",
      title: "Default with Submit Handling",
      component: (
        <AutoCompleteStoryWrapper
          placeholder="Type here..."
          suggestions={["suggestion1", "suggestion2", "suggestion3"]}
        />
      ),
    },
  ],
  meta: {
    group: "AutoCompleteInput",
    order: 1,
  },
};

export default storyExport;
