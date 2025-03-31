import { ConfirmInput } from "@inkjs/ui";
import { Box, Text } from "ink";

interface ErrorWithRetryProps {
  error?: Error;
  reload: () => Promise<unknown>;
  onCancel: () => void;
}

function ErrorWithRetry({ error, reload, onCancel }: ErrorWithRetryProps) {
  return (
    <Box
      borderStyle="round"
      borderColor="red"
      padding={1}
      gap={1}
      flexDirection="column"
    >
      <Text color="red">{error?.message}</Text>
      <Box>
        <Text color="grey">Retry? </Text>
        <ConfirmInput onConfirm={reload} onCancel={onCancel} />
      </Box>
    </Box>
  );
}

export default ErrorWithRetry;
