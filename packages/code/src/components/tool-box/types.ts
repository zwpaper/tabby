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

export interface ToolProps<
  // biome-ignore lint/suspicious/noExplicitAny: external function def.
  T extends (...args: any[]) => any = (...args: any[]) => any,
> {
  toolCall: ToolInvocation<
    InputType<T>,
    Awaited<ReturnType<T>> | { error: string }
  >;
}

// biome-ignore lint/suspicious/noExplicitAny: external function def.
type InputType<T extends (...args: any[]) => any> = Parameters<T>[0];
