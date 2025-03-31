import type { LanguageModelUsage } from "ai";
import { useState } from "react";

export function useTokenUsage() {
  const [tokenUsage, setTokenUsage] = useState<LanguageModelUsage>({
    completionTokens: 0,
    promptTokens: 0,
    totalTokens: 0,
  });

  const trackTokenUsage = (usage: LanguageModelUsage) => {
    setTokenUsage((prev) => ({
      completionTokens: prev.completionTokens + usage.completionTokens,
      promptTokens: prev.promptTokens + usage.promptTokens,
      totalTokens: prev.totalTokens + usage.totalTokens,
    }));
  };

  return {
    tokenUsage,
    trackTokenUsage,
  };
}
