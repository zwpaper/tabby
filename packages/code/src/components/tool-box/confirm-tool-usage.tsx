import { ConfirmInput } from "@inkjs/ui";
import { Box, Text, useFocus } from "ink";

export function ConfirmToolUsage({
  confirm,
}: { confirm: (approved: boolean) => void }) {
  const { isFocused } = useFocus({ autoFocus: true });

  return (
    <Box gap={1}>
      <Text color="whiteBright" underline={isFocused}>
        Allow this tool to run?
      </Text>
      <ConfirmInput
        isDisabled={!isFocused}
        onConfirm={() => confirm(true)}
        onCancel={() => confirm(false)}
      />
    </Box>
  );
}
