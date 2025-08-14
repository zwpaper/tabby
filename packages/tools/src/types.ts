export { tool as defineClientToolV5 } from "@ai-v5-sdk/ai";
import type {
  InferToolInput,
  InferToolOutput,
  ToolCallOptions,
  Tool as ToolV5,
} from "@ai-v5-sdk/ai";

export type ToolFunctionTypeV5<T extends ToolV5> = (
  input: InferToolInput<T>,
  options: ToolCallOptions & {
    nonInteractive?: boolean;
  },
) => PromiseLike<InferToolOutput<T>> | InferToolOutput<T>;

export type PreviewToolFunctionTypeV5<T extends ToolV5> = (
  args: Partial<InferToolInput<T>> | null,
  options: {
    toolCallId: string;
    state: "partial-call" | "call" | "result";
    abortSignal?: AbortSignal;
  },
) => Promise<undefined>;
