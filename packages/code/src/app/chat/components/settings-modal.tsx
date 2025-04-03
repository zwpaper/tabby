import Toggle from "@/components/toggle";
import { useModels, useTodayUsage } from "@/lib/api";
import { Select as SelectImpl, Spinner } from "@inkjs/ui";
import { Box, Text, useFocus, useInput } from "ink";

interface SettingsModalProps {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const models = useModels();
  const todayUsage = useTodayUsage();

  useInput((_, key) => {
    if (key.escape) {
      onClose();
    }
  });

  return (
    <Box width="100%" height="100%" justifyContent="center" alignItems="center">
      <Box
        width="100%"
        borderStyle="round"
        paddingX={1}
        flexDirection="column"
        gap={1}
      >
        <Box marginBottom={1} gap={1}>
          <Text bold>Settings</Text>
          <Text>(Esc to close)</Text>
        </Box>

        <Box justifyContent="space-between">
          <Text>Today's Token Usage</Text>
          {todayUsage ? (
            <Box flexDirection="column">
              <Text>Prompt: {todayUsage.promptTokens}</Text>
              <Text>Completion: {todayUsage.completionTokens}</Text>
            </Box>
          ) : (
            <Spinner />
          )}
        </Box>

        <Box justifyContent="space-between">
          <Text>Supported Models</Text>
          <Select
            isDisabled={true}
            options={models.map((model) => ({
              label: model.id,
              value: model.id,
            }))}
          />
        </Box>

        {false && (
          <Box justifyContent="space-between">
            <Text>Auto approve all command</Text>
            <Toggle />
          </Box>
        )}
      </Box>
    </Box>
  );
}

function Select(props: React.ComponentProps<typeof SelectImpl>) {
  const { isFocused } = useFocus({ autoFocus: true });
  return <SelectImpl isDisabled={!isFocused} {...props} />;
}
