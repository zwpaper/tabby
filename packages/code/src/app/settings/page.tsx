import Toggle from "@/components/toggle";
import { apiClient } from "@/lib/api";
import { useRouter } from "@/lib/router";
import { useLocalSettings } from "@/lib/storage";
import { Select as SelectImpl, Spinner } from "@inkjs/ui";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Box, Text, useFocus, useInput } from "ink";
import { Suspense } from "react";

export default function SettingsPage() {
  const { back } = useRouter();

  useInput((_, key) => {
    if (key.escape) {
      back();
    }
  });

  return (
    <Box width="100%" justifyContent="center" alignItems="center">
      <Box width="75%" justifyContent="center" alignItems="center">
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
              <Text>(Esc to go back)</Text>
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
    </Box>
  );
}

function ModelList() {
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
        visibleOptionCount={10}
      />
    </Box>
  );
}

function Select(props: React.ComponentProps<typeof SelectImpl>) {
  const { isFocused } = useFocus({ autoFocus: true });
  return <SelectImpl isDisabled={!isFocused} {...props} />;
}
