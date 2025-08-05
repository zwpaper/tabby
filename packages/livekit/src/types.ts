import type { InferUITool, UIMessage } from "@ai-v5-sdk/ai";
import type { LanguageModelV2FinishReason } from "@ai-v5-sdk/provider";
import type { ClientToolsV5 } from "@getpochi/tools";

type Metadata = {
  totalTokens: number;
  finishReason: LanguageModelV2FinishReason;
};

type DataParts = {
  checkpoint: {
    commit: string;
  };
};

type UITools = {
  [K in keyof typeof ClientToolsV5]: InferUITool<(typeof ClientToolsV5)[K]>;
};

export type Message = UIMessage<Metadata, DataParts, UITools>;
