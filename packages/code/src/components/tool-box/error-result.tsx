import { Box, Text } from "ink";

export function ErrorResult({ error }: { error: string }) {
  return (
    <Box>
      <Text color="grey">error: </Text>
      <Text>{error}</Text>
    </Box>
  );
}
