import { Select } from "@inkjs/ui";
import { Box, Text, useFocus, useInput } from "ink";
import type React from "react";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";

// Define the TextInput component props
interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onSubmit?: (value: string) => void; // Add onSubmit prop
  isFocused: boolean; // Need focus state to only capture input when active
  showSuggestion: boolean;
}

// Define the shape of the ref exposed by TextInput
export interface TextInputRef {
  resetCursor: (position: number) => void;
}

// Implement the TextInput component
const TextInput = forwardRef<TextInputRef, TextInputProps>(
  (
    { value, onChange, placeholder = "", isFocused, onSubmit, showSuggestion },
    ref,
  ) => {
    const [cursorPosition, setCursorPosition] = useState(0);

    // Expose resetCursor method via ref
    useImperativeHandle(ref, () => ({
      resetCursor: (position: number) => {
        setCursorPosition(position);
      },
    }));

    useInput(
      (input, key) => {
        // Only handle input if this component is focused
        if (!isFocused) {
          return;
        }

        if (key.leftArrow) {
          setCursorPosition(Math.max(0, cursorPosition - 1));
        } else if (key.rightArrow) {
          setCursorPosition(Math.min(value.length, cursorPosition + 1));
        } else if (key.delete) {
          // Handle backspace: delete character before cursor
          if (cursorPosition > 0) {
            const newValue =
              value.slice(0, cursorPosition - 1) + value.slice(cursorPosition);
            onChange(newValue);
            setCursorPosition(cursorPosition - 1);
          }
        } else if (key.return) {
          if (!showSuggestion) {
            // Handle Enter/Return key press
            onSubmit?.(value);
          }
          return;
        } else if (
          key.ctrl ||
          key.meta ||
          key.tab ||
          key.escape ||
          key.upArrow ||
          key.downArrow ||
          key.pageDown ||
          key.pageUp
        ) {
          // Ignore other control keys, meta keys, and navigation keys
          // Let Ink's focus management handle Tab, Up/Down etc. if suggestions are shown
          return;
        } else {
          // Append the typed character at the cursor position
          const newValue =
            value.slice(0, cursorPosition) +
            input +
            value.slice(cursorPosition);
          onChange(newValue);
          setCursorPosition(cursorPosition + 1);
        }
      },
      { isActive: isFocused },
    ); // Ensure useInput is active only when focused

    const renderCursor = () => {
      const beforeCursor = value.slice(0, cursorPosition);
      const atCursor = value.slice(cursorPosition, cursorPosition + 1) || " "; // Use space if at the end
      const afterCursor = value.slice(cursorPosition + 1);

      return (
        <>
          <Text>{beforeCursor}</Text>
          {isFocused ? (
            <Text backgroundColor="white" color="black">
              {atCursor}
            </Text>
          ) : (
            <Text>{atCursor}</Text>
          )}
          <Text>{afterCursor}</Text>
        </>
      );
    };

    return (
      <>
        {value.length > 0 ? (
          renderCursor()
        ) : (
          <>
            {isFocused ? <Text backgroundColor="white"> </Text> : null}
            <Text color="grey">{placeholder}</Text>
          </>
        )}
      </>
    );
  },
);

export interface AutoCompleteInputProps {
  suggestions: string[];
  placeholder?: string;
  onSubmit?: (value: string) => void; // Add onSubmit prop
}

const AutoCompleteInput: React.FC<AutoCompleteInputProps> = ({
  suggestions,
  placeholder = "",
  onSubmit, // Destructure onSubmit
}) => {
  const [value, setValue] = useState("");
  const [showSuggestionInternal, setShowSuggestionInternal] = useState(false);
  const { isFocused } = useFocus({ autoFocus: true });
  const textInputRef = useRef<TextInputRef>(null); // Create a ref for TextInput

  const onChange = (newValue: string) => {
    if (newValue[newValue.length - 1] === "@") {
      setShowSuggestionInternal(true);
    } else {
      setShowSuggestionInternal(false);
    }
    setValue(newValue);
  };

  const handleSelect = (selectedValue: string) => {
    const newValue = value + selectedValue;
    setValue(newValue);
    textInputRef.current?.resetCursor(newValue.length);
    setShowSuggestionInternal(false);
  };

  function handleSubmit(value: string) {
    onSubmit?.(value);
    setValue("");
  }

  const suggestionItems = suggestions.map((suggestion) => ({
    label: suggestion,
    value: suggestion,
  }));

  // Determine if suggestions should be shown based on focus, trigger, and available items
  const showSuggestion =
    showSuggestionInternal && suggestionItems.length > 0 && isFocused;

  return (
    <Box flexDirection="column">
      <Box borderStyle="round" borderColor={isFocused ? "blue" : "grey"}>
        <TextInput
          ref={textInputRef} // Pass the ref
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          showSuggestion={showSuggestion}
          isFocused={isFocused} // Pass focus state down
          onSubmit={handleSubmit} // Pass onSubmit down
        />
      </Box>
      {showSuggestion && (
        <Select
          options={suggestionItems}
          onChange={handleSelect} // This onChange is specific to the Select component
        />
      )}
    </Box>
  );
};

export default AutoCompleteInput;
