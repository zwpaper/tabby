import { useApiClient } from "@/lib/api";
import type { useTokenUsage } from "@/lib/hooks/use-token-usage";
import { useLocalSettings } from "@/lib/storage";
import type { useChat } from "@ai-sdk/react";
import { ProgressBar } from "@inkjs/ui";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { User } from "better-auth";
import { Box, Text } from "ink";
import { Suspense } from "react";

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

function formatContextWindow(size: number, maxWindow: number): number {
  const percentage = size / maxWindow;
  return percentage * 100;
}

function HeaderContent({ tokenUsage, status }: ChatHeaderProps) {
  const apiClient = useApiClient();
  const [{ model }] = useLocalSettings();
  const { data: models } = useSuspenseQuery({
    queryKey: ["models"],
    queryFn: async () => {
      const res = await apiClient.api.models.$get();
      return await res.json();
    },
  });

  const currentModel = models.find((m) => m.id === model);
  const maxContextWindow = currentModel?.contextWindow ?? 128_000;

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
          <ProgressBar
            value={formatContextWindow(
              tokenUsage.contextTokens,
              maxContextWindow,
            )}
          />
          <Text>{formatTokenCount(maxContextWindow)}</Text>
        </Box>
      </Box>
    </Box>
  );
}

function ChatHeader(props: ChatHeaderProps) {
  return (
    <Suspense>
      <HeaderContent {...props} />
    </Suspense>
  );
}

export default ChatHeader;
