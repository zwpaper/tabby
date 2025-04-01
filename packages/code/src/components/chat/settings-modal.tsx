import { Select } from "@inkjs/ui";
import { Box, Text, useInput } from "ink";
import { useState } from "react";
import Toggle from "../toggle";

interface SettingsModalProps {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const [autoApprove, setAutoApprove] = useState(false);

  useInput((_, key) => {
    if (key.escape) {
      onClose();
    }
  });

  const handleSelect = (item: string) => {
    console.log(`Selected: ${item}`);
  };

  return (
    <Box
      width={81}
      borderStyle="round"
      paddingX={1}
      marginTop={1}
      flexDirection="column"
    >
      <Box marginBottom={1} gap={1}>
        <Text bold>Settings</Text>
        <Text>(Esc to close)</Text>
      </Box>

      <Box justifyContent="space-between">
        <Text>Model</Text>
        <Select
          defaultValue={AvailableModels[0]}
          options={AvailableModels.map((model) => ({
            label: model,
            value: model,
          }))}
          onChange={handleSelect}
        />
      </Box>

      <Box justifyContent="space-between">
        <Text>Auto approve all command</Text>
        <Toggle value={autoApprove} onChange={setAutoApprove} />
      </Box>
    </Box>
  );
}

const AvailableModels = ["gemini-2.5-pro"];
