import type { ToolCall, ToolResult } from "@ai-sdk/provider-utils";

export type ToolInvocation<INPUT, OUTPUT> =
  | ({
      state: "partial-call";
      step?: number;
    } & ToolCall<string, INPUT>)
  | ({
      state: "call";
      step?: number;
    } & ToolCall<string, INPUT>)
  | ({
      state: "result";
      step?: number;
    } & ToolResult<string, INPUT, OUTPUT>);

// biome-ignore lint/suspicious/noExplicitAny: external function def.
export interface ToolProps<INPUT = any, OUTPUT = any> {
  toolCall: ToolInvocation<INPUT, OUTPUT>;
}
