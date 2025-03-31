import type { User } from "@instantdb/react";
import type { LanguageModelUsage } from "ai";
import { Box, Text } from "ink";

interface ChatHeaderProps {
  user: User;
  tokenUsage: LanguageModelUsage;
}

function formatTokenCount(count: number): string {
  if (count < 1000) {
    return count.toString();
  }
  return `${(count / 1000).toFixed(1)}k`;
}

function ChatHeader({ user, tokenUsage }: ChatHeaderProps) {
  return (
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
  );
}

export default ChatHeader;
