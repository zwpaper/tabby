import type { InferUITool, UIMessage } from "@ai-v5-sdk/ai";
import type { ClientToolsV5 } from "@getpochi/tools";

type DataParts = {
  checkpoint: {
    commit: string;
  };
};

type UITools = {
  [K in keyof typeof ClientToolsV5]: InferUITool<(typeof ClientToolsV5)[K]>;
};

export type Message = UIMessage<never, DataParts, UITools>;
