import { ConfirmInput } from "@inkjs/ui";
import { Box, Text, useFocus } from "ink";

export function ConfirmPrompt({
  confirm,
  prompt,
}: { confirm: (result: boolean) => void; prompt: string }) {
  const { isFocused } = useFocus({ autoFocus: true });

  return (
    <Box gap={1}>
      <Text color="whiteBright" underline={isFocused}>
        {prompt}
      </Text>
      <ConfirmInput
        isDisabled={!isFocused}
        onConfirm={() => confirm(true)}
        onCancel={() => confirm(false)}
      />
    </Box>
  );
}
