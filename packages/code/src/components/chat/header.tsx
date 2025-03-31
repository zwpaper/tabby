import type { useTokenUsage } from "@/lib/hooks/use-token-usage";
import { ProgressBar } from "@inkjs/ui";
import type { User } from "@instantdb/react";
import { Box, Text } from "ink";

interface ChatHeaderProps {
  user: User;
  tokenUsage: ReturnType<typeof useTokenUsage>["tokenUsage"];
}

function formatTokenCount(count: number): string {
  if (count < 1000) {
    return count.toString();
  }
  if (count < 1000000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return `${(count / 1000000).toFixed(1)}m`;
}

const MaxContextWindow = 128_000;

function formatContextWindow(size: number): number {
  // Total context window is 1M
  const percentage = size / MaxContextWindow;
  return percentage * 100;
}

function ChatHeader({ user, tokenUsage }: ChatHeaderProps) {
  return (
    <Box alignItems="center" gap={1}>
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="cyan"
        paddingX={1}
        width={32}
      >
        <Text>Welcome {user.email}</Text>
        <Text>
          Tokens: ↑ {formatTokenCount(tokenUsage.promptTokens)} ↓{" "}
          {formatTokenCount(tokenUsage.completionTokens)}
        </Text>
      </Box>
      <Box
        flexDirection="column"
        width={32}
        borderStyle="round"
        borderColor="blue"
        paddingX={1}
      >
        <Text>Context Window:</Text>
        <Box gap={1}>
          <Text>{formatTokenCount(tokenUsage.contextTokens)}</Text>
          <ProgressBar value={formatContextWindow(tokenUsage.contextTokens)} />
          <Text>{formatTokenCount(MaxContextWindow)}</Text>
        </Box>
      </Box>
    </Box>
  );
}

export default ChatHeader;
