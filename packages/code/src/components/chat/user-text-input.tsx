import TextInput from "@/components/text-input";
import { useEnvironment } from "@/lib/hooks/use-environment";
import Fuse from "fuse.js";
import { Box, Text, useFocus, useInput } from "ink";
import { useEffect, useState } from "react";

export default function UserTextInput({
  onChange,
  onSubmit,
}: { onChange: (input: string) => void; onSubmit: (input: string) => void }) {
  const { isFocused } = useFocus({ autoFocus: true });
  const borderColor = isFocused ? "white" : "gray";
  const [inputValue, setInputValue] = useState("");
  const [isFilePickerActive, setIsFilePickerActive] = useState(false);
  const [fileQuery, setFileQuery] = useState("");
  const [filteredFiles, setFilteredFiles] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [triggerIndex, setTriggerIndex] = useState(-1); // Index where '@' was typed

  // FIXME: list files without using the environment hook
  const environment = useEnvironment();
  const files = environment?.workspace.files;

  const fuse = new Fuse(files || [], {
    // Fuse.js options
    threshold: 0.4,
  });

  useEffect(() => {
    if (isFilePickerActive) {
      if (fileQuery === "") {
        // Show all files initially or based on context if needed
        setFilteredFiles(files?.slice(0, 10) || []); // Limit initial display
      } else {
        const results = fuse.search(fileQuery);
        setFilteredFiles(results.map((result) => result.item).slice(0, 10)); // Limit results
      }
      setSelectedIndex(0); // Reset selection when query changes
    } else {
      setFilteredFiles([]);
    }
  }, [fileQuery, isFilePickerActive, files, fuse.search]);

  const handleInputChange = (newValue: string) => {
    let finalValue = newValue;
    // Check if this change was a single character deletion (likely backspace)
    if (newValue.length === inputValue.length - 1) {
      // Find the approximate deletion index by comparing old and new values
      let deletionIndex = -1;
      for (let i = 0; i < inputValue.length; i++) {
        if (i >= newValue.length || inputValue[i] !== newValue[i]) {
          deletionIndex = i;
          break;
        }
      }

      if (deletionIndex !== -1) {
        const valueBeforeDeletion = inputValue.substring(0, deletionIndex);

        // Check if the character before the deleted one ends a potential file path
        // Regex: ends with './' followed by non-space characters
        const filePathRegex = /\.\/[^\s]+$/;
        if (filePathRegex.test(valueBeforeDeletion)) {
          // Find the start of this file path
          const pathStartIndex = valueBeforeDeletion.lastIndexOf("./");
          if (pathStartIndex !== -1) {
            // Construct the new value by removing the entire path
            finalValue =
              inputValue.substring(0, pathStartIndex) +
              inputValue.substring(deletionIndex + 1);
            // We directly manipulate finalValue here, which will be used below.
          }
        }
      }
    }

    // Update state with the potentially modified value
    setInputValue(finalValue);
    onChange(finalValue); // Propagate change

    // --- Existing file picker logic --- //
    const atIndex = finalValue.lastIndexOf("@");
    // Find the next space *after* the potential '@' trigger
    const nextSpaceIndex = finalValue.indexOf(" ", atIndex > -1 ? atIndex : 0);

    if (atIndex !== -1 && (nextSpaceIndex === -1 || nextSpaceIndex > atIndex)) {
      // If '@' exists and there's no space immediately after it
      const currentQuery = finalValue.substring(atIndex + 1);
      if (!isFilePickerActive) {
        setIsFilePickerActive(true);
        setTriggerIndex(atIndex);
      }
      setFileQuery(currentQuery);
    } else {
      // If no '@' trigger or there's a space after it
      if (isFilePickerActive) {
        setIsFilePickerActive(false);
        setFileQuery("");
        setTriggerIndex(-1);
      }
    }
  };

  const handleSelectFile = (selectedFile: string | null) => {
    if (selectedFile && triggerIndex !== -1) {
      const newValue = `${inputValue.substring(0, triggerIndex)}./${selectedFile} `; // Add space after selection
      setInputValue(newValue);
      onChange(newValue); // Propagate change
    }
    setIsFilePickerActive(false);
    setFileQuery("");
    setFilteredFiles([]);
    setTriggerIndex(-1);
  };

  useInput(
    (_, key) => {
      if (!isFilePickerActive) {
        return; // Ignore input if picker is not active
      }

      if (key.upArrow) {
        setSelectedIndex((prevIndex) => Math.max(0, prevIndex - 1));
      } else if (key.downArrow) {
        setSelectedIndex((prevIndex) =>
          Math.min(filteredFiles.length - 1, prevIndex + 1),
        );
      } else if (key.return) {
        if (filteredFiles.length > 0 && selectedIndex < filteredFiles.length) {
          handleSelectFile(filteredFiles[selectedIndex]);
        } else {
          handleSelectFile(null); // Or potentially insert query as is?
        }
      } else if (key.escape) {
        handleSelectFile(null); // Cancel
      }
      // Prevent TextInput from processing these keys when picker is active
    },
    { isActive: isFilePickerActive }, // Only active when picker is shown
  );

  const handleSubmit = () => {
    if (!isFilePickerActive) {
      onSubmit(inputValue);
      setInputValue(""); // Clear input after submit
      onChange(""); // Also clear parent state if needed
    }
  };

  return (
    <Box flexDirection="column">
      {isFilePickerActive && filteredFiles.length > 0 && (
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor="blue"
          paddingX={1}
          marginBottom={1}
        >
          {filteredFiles.map((file, index) => (
            <Text
              key={file}
              color={index === selectedIndex ? "cyan" : undefined}
            >
              {index === selectedIndex ? "> " : "  "}
              {file}
            </Text>
          ))}
        </Box>
      )}
      <Box borderStyle="round" borderColor={borderColor} padding={1}>
        <TextInput
          value={inputValue}
          onChange={handleInputChange}
          onSubmit={handleSubmit}
          placeholder="Type @ to mention files..."
        />
      </Box>
    </Box>
  );
}
