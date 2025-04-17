import TextInput from "@/components/text-input";
import { useRouter } from "@/lib/router";
import { traverseBFS } from "@/lib/tools/file-utils";
import Fuse from "fuse.js";
import { Box, Text, useFocus, useInput } from "ink";
import { useEffect, useState } from "react";

// Define commands
const COMMANDS = [
  { name: "/logout", description: "Log out from the application", prompt: "" },
  {
    name: "/test",
    description: "Run unit tests",
    prompt: "Please run the unit tests and fix any errors",
  },
  {
    name: "/lint",
    description: "Run linter",
    prompt: "Please run the linter and fix any errors",
  },
  {
    name: "/commit",
    description: "Generate commit message",
    prompt:
      "Generate a concise commit message in conventional commit format based on the staged changes. Then, commit the changes. If there are unstaged changes, stage them first.",
  },
  {
    name: "/push",
    description: "Push changes to remote",
    prompt: "Please push the current branch to the remote repository.",
  },
  {
    name: "/clear",
    description: "Clear message history",
    prompt: "", // No prompt needed, action is immediate
  },
  {
    name: "/settings",
    description: "Open settings",
    prompt: "", // No prompt needed, action is immediate
  },
  {
    name: "/explain",
    description: "Explain the workspace",
    prompt:
      "Please explain what does this workspace do, with brief summary of each component.",
  },
  {
    name: "/quit",
    description: "Exit chat",
    prompt: "", // No prompt needed, action is immediate
  },
];

// Command type
interface Command {
  name: string;
  description: string;
  prompt: string;
}

export default function UserTextInput({
  onChange,
  onSubmit,
  onLogout,
  onClearHistory,
  onScroll, // Add new prop for scrolling
}: {
  onChange: (input: string) => void;
  onSubmit: (input: string) => void;
  onLogout: () => void;
  onClearHistory: () => void;
  onScroll?: (step: number) => void; // Define optional prop type for scrolling
}) {
  const { navigate, back } = useRouter();
  const { isFocused } = useFocus({ autoFocus: true });
  const borderColor = isFocused ? "white" : "gray";
  const [inputValue, setInputValue] = useState("");

  // File Picker State
  const [isFilePickerActive, setIsFilePickerActive] = useState(false);
  const [fileQuery, setFileQuery] = useState("");
  const [filteredFiles, setFilteredFiles] = useState<string[]>([]);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [fileTriggerIndex, setFileTriggerIndex] = useState(-1); // Index where '@' was typed

  // Command Picker State
  const [isCommandPickerActive, setIsCommandPickerActive] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [filteredCommands, setFilteredCommands] = useState<Command[]>([]);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [commandTriggerIndex, setCommandTriggerIndex] = useState(-1); // Index where '/' was typed

  const [files, setFiles] = useState<string[]>([]);
  useEffect(() => {
    if (isFilePickerActive) {
      traverseBFS(".", true, 5000).then((data) => setFiles(data.files));
    }
  }, [isFilePickerActive]);

  const fileFuse = new Fuse(files || []);

  const commandFuse = new Fuse(COMMANDS, {
    keys: ["name", "description"],
  });

  // Effect for File Picker Filtering
  useEffect(() => {
    if (isFilePickerActive) {
      if (fileQuery === "") {
        setFilteredFiles(files?.slice(0, 5) || []); // Limit initial display
      } else {
        const results = fileFuse.search(fileQuery);
        setFilteredFiles(results.map((result) => result.item).slice(0, 5)); // Limit results
      }
      setSelectedFileIndex(0); // Reset selection when query changes
    } else {
      setFilteredFiles([]);
    }
  }, [fileQuery, isFilePickerActive, files, fileFuse.search]); // Ensure fileFuse.search is stable or memoized if needed

  // Effect for Command Picker Filtering
  useEffect(() => {
    if (isCommandPickerActive) {
      if (commandQuery === "") {
        setFilteredCommands(COMMANDS.slice(0, 5)); // Show all commands initially
      } else {
        const results = commandFuse.search(commandQuery);
        setFilteredCommands(results.map((result) => result.item).slice(0, 5)); // Limit results
      }
      setSelectedCommandIndex(0); // Reset selection when query changes
    } else {
      setFilteredCommands([]);
    }
  }, [commandQuery, isCommandPickerActive, commandFuse.search]); // Ensure commandFuse.search is stable or memoized if needed

  const handleInputChange = (newValue: string) => {
    let finalValue = newValue;

    // --- Existing Backspace Logic for File Paths --- //
    if (newValue.length === inputValue.length - 1) {
      let deletionIndex = -1;
      for (let i = 0; i < inputValue.length; i++) {
        if (i >= newValue.length || inputValue[i] !== newValue[i]) {
          deletionIndex = i;
          break;
        }
      }
      if (deletionIndex !== -1) {
        const valueBeforeDeletion = inputValue.substring(0, deletionIndex);
        const filePathRegex = /\.\/[^\s]+$/;
        if (filePathRegex.test(valueBeforeDeletion)) {
          const pathStartIndex = valueBeforeDeletion.lastIndexOf("./");
          if (pathStartIndex !== -1) {
            finalValue =
              inputValue.substring(0, pathStartIndex) +
              inputValue.substring(deletionIndex + 1);
          }
        }
      }
    }
    // --- End Backspace Logic --- //

    setInputValue(finalValue);
    onChange(finalValue); // Propagate change

    // --- Picker Activation Logic --- //
    const atIndex = finalValue.lastIndexOf("@");
    const slashIndex = finalValue.lastIndexOf("/");
    const nextSpaceAfterAt = finalValue.indexOf(
      " ",
      atIndex > -1 ? atIndex : 0,
    );
    const nextSpaceAfterSlash = finalValue.indexOf(
      " ",
      slashIndex > -1 ? slashIndex : 0,
    );

    // Activate File Picker?
    if (
      atIndex !== -1 &&
      nextSpaceAfterAt === -1 &&
      atIndex > slashIndex // Ensure '@' is after the last '/' or if no '/' exists
    ) {
      const currentQuery = finalValue.substring(atIndex + 1);
      if (!isFilePickerActive) {
        setIsFilePickerActive(true);
        setIsCommandPickerActive(false); // Deactivate command picker
        setFileTriggerIndex(atIndex);
      }
      setFileQuery(currentQuery);
    } else {
      if (isFilePickerActive) {
        setIsFilePickerActive(false);
        setFileQuery("");
        setFileTriggerIndex(-1);
      }
    }

    // Activate Command Picker?
    if (
      slashIndex !== -1 &&
      nextSpaceAfterSlash === -1 &&
      slashIndex > atIndex // Ensure '/' is after the last '@' or if no '@' exists
    ) {
      const currentQuery = finalValue.substring(slashIndex + 1);
      if (!isCommandPickerActive) {
        setIsCommandPickerActive(true);
        setIsFilePickerActive(false); // Deactivate file picker
        setCommandTriggerIndex(slashIndex);
      }
      setCommandQuery(currentQuery);
    } else {
      if (isCommandPickerActive) {
        setIsCommandPickerActive(false);
        setCommandQuery("");
        setCommandTriggerIndex(-1);
      }
    }

    // Deactivate both if conditions aren't met (e.g., space added, trigger char deleted)
    if (
      isFilePickerActive &&
      (atIndex === -1 ||
        (nextSpaceAfterAt !== -1 && nextSpaceAfterAt === atIndex + 1))
    ) {
      setIsFilePickerActive(false);
      setFileQuery("");
      setFileTriggerIndex(-1);
    }
    if (
      isCommandPickerActive &&
      (slashIndex === -1 ||
        (nextSpaceAfterSlash !== -1 && nextSpaceAfterSlash === slashIndex + 1))
    ) {
      setIsCommandPickerActive(false);
      setCommandQuery("");
      setCommandTriggerIndex(-1);
    }
  };

  const handleSelectFile = (selectedFile: string | null) => {
    if (selectedFile && fileTriggerIndex !== -1) {
      const newValue = `${inputValue.substring(
        0,
        fileTriggerIndex,
      )}./${selectedFile} `; // Add space after selection
      setInputValue(newValue);
      onChange(newValue); // Propagate change
    }
    setIsFilePickerActive(false);
    setFileQuery("");
    setFilteredFiles([]);
    setFileTriggerIndex(-1);
  };

  const handleSelectCommand = (selectedCommand: Command | null) => {
    if (selectedCommand && commandTriggerIndex !== -1) {
      // Execute command action
      if (selectedCommand.name === "/logout") {
        onLogout();
        setInputValue("");
        onChange("");
      } else if (selectedCommand.name === "/quit") {
        back();
      } else if (selectedCommand.name === "/clear") {
        // Handle /clear
        onClearHistory();
        setInputValue("");
        onChange("");
      } else if (selectedCommand.name === "/settings") {
        // Navigate to settings page instead of opening modal
        navigate("/settings");
        setInputValue("");
        onChange("");
      } else {
        // Handle other commands or insert command name if needed
        const newValue = `${inputValue.substring(
          0,
          commandTriggerIndex,
        )}${selectedCommand.prompt}`;
        setInputValue(newValue);
        onChange(newValue);
      }
    }
    // Reset command picker state
    setIsCommandPickerActive(false);
    setCommandQuery("");
    setFilteredCommands([]);
    setCommandTriggerIndex(-1);
  };

  useInput(
    (_, key) => {
      if (isFilePickerActive) {
        if (key.upArrow) {
          setSelectedFileIndex((prevIndex) => Math.max(0, prevIndex - 1));
        } else if (key.downArrow) {
          setSelectedFileIndex((prevIndex) =>
            Math.min(filteredFiles.length - 1, prevIndex + 1),
          );
        } else if (key.return) {
          if (
            filteredFiles.length > 0 &&
            selectedFileIndex < filteredFiles.length
          ) {
            handleSelectFile(filteredFiles[selectedFileIndex]);
          } else {
            handleSelectFile(null); // Or potentially insert query as is?
          }
        } else if (key.escape) {
          handleSelectFile(null); // Cancel
        }
      } else if (isCommandPickerActive) {
        if (key.upArrow) {
          setSelectedCommandIndex((prevIndex) => Math.max(0, prevIndex - 1));
        } else if (key.downArrow) {
          setSelectedCommandIndex((prevIndex) =>
            Math.min(filteredCommands.length - 1, prevIndex + 1),
          );
        } else if (key.return) {
          if (
            filteredCommands.length > 0 &&
            selectedCommandIndex < filteredCommands.length
          ) {
            handleSelectCommand(filteredCommands[selectedCommandIndex]);
          } else {
            handleSelectCommand(null); // Or potentially insert query as is?
          }
        } else if (key.escape) {
          handleSelectCommand(null); // Cancel
        }
      } else if (onScroll) {
        // Handle scrolling when no pickers are active and onScroll is provided
        if (key.upArrow) {
          onScroll(-1);
        } else if (key.downArrow) {
          onScroll(1);
        }
      }
    },
    { isActive: isFilePickerActive || isCommandPickerActive || !!onScroll }, // Active if either picker is shown or scrolling is enabled
  );

  const handleSubmit = () => {
    // Prevent submit if a picker is active and waiting for selection
    if (!isFilePickerActive && !isCommandPickerActive) {
      onSubmit(inputValue);
      setInputValue(""); // Clear input after submit
      onChange(""); // Also clear parent state if needed
    } else if (isFilePickerActive) {
      // Optionally handle Enter press when file picker is active but no file selected
      handleSelectFile(null); // Cancel picker on submit? Or select current?
    } else if (isCommandPickerActive) {
      // Optionally handle Enter press when command picker is active but no command selected
      handleSelectCommand(null); // Cancel picker on submit? Or select current?
    }
  };

  return (
    <Box flexDirection="column" width="100%">
      {/* Text Input Area */}
      <Box borderStyle="round" borderColor={borderColor} padding={1}>
        <TextInput
          disabled={!isFocused}
          value={inputValue}
          onChange={handleInputChange}
          onSubmit={handleSubmit}
          placeholder="Type @ to mention files or / for commands..." // Updated placeholder
        />
      </Box>

      {/* Command Picker */}
      {isCommandPickerActive && filteredCommands.length > 0 && (
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor="green" // Different color for command picker
          paddingX={1}
        >
          {filteredCommands.map((command, index) => (
            <Text
              key={command.name}
              color={index === selectedCommandIndex ? "cyan" : undefined}
            >
              {index === selectedCommandIndex ? "> " : "  "}
              {command.name}
              <Text color="gray"> - {command.description}</Text>
            </Text>
          ))}
        </Box>
      )}

      {/* File Picker */}
      {isFilePickerActive && filteredFiles.length > 0 && (
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor="blue"
          paddingX={1}
        >
          {filteredFiles.map((file, index) => (
            <Text
              key={file}
              color={index === selectedFileIndex ? "cyan" : undefined}
            >
              {index === selectedFileIndex ? "> " : "  "}
              {file}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
}
