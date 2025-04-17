import { Box } from "ink";
import TruncatedText from "../truncated-text";

const MAX_LINES = 5;

export function ErrorResult({ error }: { error: string }) {
  return (
    <Box>
      <TruncatedText
        color="grey"
        maxLines={MAX_LINES}
        hiddenLinesSuffix="more error lines"
      >
        {error}
      </TruncatedText>
    </Box>
  );
}
