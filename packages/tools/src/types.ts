import { type Tool, type ToolExecutionOptions, tool } from "ai";

import type { z } from "zod";

export function defineClientTool<
  PARAMETERS extends z.ZodTypeAny,
  RESULT extends z.ZodTypeAny,
>({
  description,
  inputSchema,
  execute,
}: {
  description: string;
  inputSchema: PARAMETERS;
  outputSchema: RESULT;
  execute: ToolFunctionType<Tool<PARAMETERS, RESULT>>;
}): {
  tool: Tool<PARAMETERS, RESULT>;
  execute: ToolFunctionType<Tool<PARAMETERS, RESULT>>;
} {
  return {
    tool: tool({
      description,
      parameters: inputSchema,
    }),
    execute,
  };
}

// biome-ignore lint/suspicious/noExplicitAny: template matching.
type ToolInputType<T extends Tool<any, any>> = z.infer<T["parameters"]>;

// biome-ignore lint/suspicious/noExplicitAny: template matching.
type ToolOutputType<T extends Tool<any, any>> = z.infer<
  Awaited<ReturnType<NonNullable<T["execute"]>>>
>;

// biome-ignore lint/suspicious/noExplicitAny: template matching.
export type ToolFunctionType<T extends Tool<any, any>> = (
  args: ToolInputType<T>,
  options: ToolExecutionOptions,
) => Promise<ToolOutputType<T>>;

export function defineServerTool<
  PARAMETERS extends z.ZodTypeAny,
  RESULT extends z.ZodTypeAny,
  T,
>({
  description,
  inputSchema,
  makeExecuteFn,
}: {
  description: string;
  inputSchema: PARAMETERS;
  outputSchema: RESULT; // Define the expected output shape
  makeExecuteFn: (ctx: T) => ToolFunctionType<Tool<PARAMETERS, RESULT>>; // Use the existing type
}) {
  return (ctx: T): Tool<PARAMETERS, RESULT> => {
    return tool({
      description,
      parameters: inputSchema,
      execute: makeExecuteFn(ctx),
    });
  };
}
