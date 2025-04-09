import { ConfirmInput } from "@inkjs/ui";
import { Box, Text, useFocus } from "ink";

interface ErrorWithRetryProps {
  error?: Error;
  onRetry: () => Promise<unknown>;
  onCancel: () => void;
  isLoading: boolean;
}

function ErrorWithRetry({
  error,
  onRetry,
  onCancel,
  isLoading,
}: ErrorWithRetryProps) {
  const { isFocused } = useFocus({ autoFocus: false });
  return (
    !isLoading && (
      <Box
        borderStyle="round"
        borderColor="red"
        padding={1}
        gap={1}
        flexDirection="column"
      >
        <Text color="red">{error?.message}</Text>
        <Box>
          <Text color="grey" underline={isFocused}>
            Retry?{" "}
          </Text>
          <ConfirmInput onConfirm={onRetry} onCancel={onCancel} />
        </Box>
      </Box>
    )
  );
}

export default ErrorWithRetry;
