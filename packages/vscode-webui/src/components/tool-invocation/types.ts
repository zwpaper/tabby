import type { ToolCall, ToolResult } from "@ai-sdk/provider-utils";
import type { ToolFunctionType } from "@ragdoll/tools";
import type { ChatRequestOptions, CreateMessage, Message, Tool } from "ai";

export type ToolInvocation<INPUT, OUTPUT> =
  | ({
      state: "partial-call";
      step?: number;
    } & ToolCall<string, Optional<INPUT> | undefined>)
  | ({
      state: "call";
      step?: number;
    } & ToolCall<string, INPUT>)
  | ({
      state: "result";
      step?: number;
    } & ToolResult<string, INPUT, OUTPUT>);

// biome-ignore lint/suspicious/noExplicitAny: template matching.
export interface ToolProps<T extends Tool<any, any> = Tool<any, any>> {
  tool: ToolInvocation<
    InputType<ToolFunctionType<T>>,
    Awaited<ReturnType<ToolFunctionType<T>>> | { error: string }
  >;
  isExecuting: boolean;
  isLoading: boolean;
  sendMessage: (
    message: Message | CreateMessage,
    chatRequestOptions?: ChatRequestOptions,
  ) => Promise<string | null | undefined>;
  streamResult?: { result: Awaited<ReturnType<ToolFunctionType<T>>> };
}

// biome-ignore lint/suspicious/noExplicitAny: external function def.
type InputType<T extends (...args: any[]) => any> = Parameters<T>[0];

type Optional<T> = { [K in keyof T]: T[K] | undefined };
