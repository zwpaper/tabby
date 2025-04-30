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
  args: Partial<ToolInputType<T>>,
  options: ToolExecutionOptions,
) => void;

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
