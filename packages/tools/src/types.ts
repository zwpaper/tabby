import { type Tool, type ToolExecutionOptions, tool } from "ai";

import type { z } from "zod";

export function defineClientTool<
  PARAMETERS extends z.ZodTypeAny,
  RESULT extends z.ZodTypeAny,
>({
  description,
  inputSchema,
}: {
  description: string;
  inputSchema: PARAMETERS;
  outputSchema: RESULT;
}): Tool<PARAMETERS, RESULT> {
  return tool({
    description,
    parameters: inputSchema,
  });
}

type ToolInputType<T extends Tool> = z.infer<T["parameters"]>;

type ToolOutputType<T extends Tool> = z.infer<
  Awaited<ReturnType<NonNullable<T["execute"]>>>
>;

export type ToolFunctionType<T extends Tool> = (
  args: ToolInputType<T>,
  options: ToolExecutionOptions,
) => Promise<ToolOutputType<T>>;

export type PreviewToolFunctionType<T extends Tool> = (
  args: Partial<ToolInputType<T>> | null,
  options: {
    toolCallId: string;
    state: "partial-call" | "call" | "result";
  },
) => Promise<undefined>;

export function defineServerTool<
  PARAMETERS extends z.ZodTypeAny,
  RESULT extends z.ZodTypeAny,
  T,
>({
  tool: toolDef,
  makeExecuteFn,
}: {
  tool: Tool<PARAMETERS, RESULT>;
  makeExecuteFn: (ctx: T) => ToolFunctionType<Tool<PARAMETERS, RESULT>>; // Use the existing type
}) {
  return (ctx: T): Tool<PARAMETERS, RESULT> => {
    return tool({
      description: toolDef.description,
      parameters: toolDef.parameters,
      execute: makeExecuteFn(ctx),
    });
  };
}

export function declareServerTool<
  PARAMETERS extends z.ZodTypeAny,
  RESULT extends z.ZodTypeAny,
>({
  description,
  inputSchema,
}: {
  description: string;
  inputSchema: PARAMETERS;
  outputSchema: RESULT;
}): Tool<PARAMETERS, RESULT> {
  return tool({
    description,
    parameters: inputSchema,
  });
}
