import type { useTokenUsage } from "@/lib/hooks/use-token-usage";
import { useLocalSettings } from "@/lib/storage";
import type { useChat } from "@ai-sdk/react";
import { ProgressBar } from "@inkjs/ui";
import type { User } from "better-auth";
import { Box, Text } from "ink";

interface ChatHeaderProps {
  user: User;
  tokenUsage: ReturnType<typeof useTokenUsage>["tokenUsage"];
  status: ReturnType<typeof useChat>["status"];
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

function ChatHeader({ tokenUsage, status }: ChatHeaderProps) {
  const [{ model }] = useLocalSettings();

  return (
    <Box alignItems="center" gap={1} width="100%">
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="cyan"
        paddingX={1}
        width={45}
      >
        <Text>Model: {model}</Text>
        <Text>
          Tokens: ↑ {formatTokenCount(tokenUsage.promptTokens)} ↓{" "}
          {formatTokenCount(tokenUsage.completionTokens)} ( {status} )
        </Text>
      </Box>
      <Box
        flexDirection="column"
        width={45}
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
