export { tool as defineClientTool } from "@ai-v5-sdk/ai";
import type {
  InferToolInput,
  InferToolOutput,
  Tool,
  ToolCallOptions,
} from "@ai-v5-sdk/ai";

export type ToolFunctionType<T extends Tool> = (
  input: InferToolInput<T>,
  options: ToolCallOptions & {
    nonInteractive?: boolean;
  },
) => PromiseLike<InferToolOutput<T>> | InferToolOutput<T>;

export type PreviewToolFunctionType<T extends Tool> = (
  args: Partial<InferToolInput<T>> | null,
  options: {
    toolCallId: string;
    state: "partial-call" | "call" | "result";
    abortSignal?: AbortSignal;
  },
) => Promise<undefined>;
