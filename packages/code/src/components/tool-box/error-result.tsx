import { Box, Text } from "ink";
import Collapsible from "../collapsible";

const MAX_LINES = 5;

export function ErrorResult({ error }: { error: string }) {
  const lines = error.split('\n');
  const isLongError = lines.length > MAX_LINES;

  if (isLongError) {
    return (
      <Collapsible title="error" open={false}>
        <Text>{error}</Text>
      </Collapsible>
    );
  }

  return (
    <Box>
      <Text color="grey">error: </Text>
      <Text>{error}</Text>
    </Box>
  );
}
