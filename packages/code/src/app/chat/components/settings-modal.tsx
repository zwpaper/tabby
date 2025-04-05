import Toggle from "@/components/toggle";
import { useApiClient } from "@/lib/api";
import { useLocalSettings } from "@/lib/storage";
import { Select as SelectImpl, Spinner } from "@inkjs/ui";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Box, Text, useFocus, useInput } from "ink";
import { Suspense } from "react";

interface SettingsModalProps {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  useInput((_, key) => {
    if (key.escape) {
      onClose();
    }
  });

  return (
    <Box width="100%" height="100%" justifyContent="center" alignItems="center">
      <Suspense fallback={<Spinner />}>
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

          <ModelList />

          {false && (
            <Box justifyContent="space-between">
              <Text>Auto approve all command</Text>
              <Toggle />
            </Box>
          )}
        </Box>
      </Suspense>
    </Box>
  );
}

function ModelList() {
  const apiClient = useApiClient();
  const [{ model }, updateSettings] = useLocalSettings();
  const { data: models } = useSuspenseQuery({
    queryKey: ["models"],
    queryFn: async () => {
      const res = await apiClient.api.models.$get();
      return await res.json();
    },
  });
  return (
    <Box justifyContent="space-between">
      <Text>Supported Models</Text>
      <Select
        onChange={(x) => updateSettings({ model: x })}
        defaultValue={model}
        options={models.map((model) => ({
          label: model.id,
          value: model.id,
        }))}
      />
    </Box>
  );
}

function Select(props: React.ComponentProps<typeof SelectImpl>) {
  const { isFocused } = useFocus({ autoFocus: true });
  return <SelectImpl isDisabled={!isFocused} {...props} />;
}
