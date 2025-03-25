import { type Tool, tool } from "ai";

import type { z } from "zod";

export function declareClientTool<
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

// biome-ignore lint/suspicious/noExplicitAny: template matching.
export type ToolInputType<T extends Tool<any, any>> = z.infer<T["parameters"]>;

// biome-ignore lint/suspicious/noExplicitAny: template matching.
type ToolOutputTypeNoError<T extends Tool<any, any>> = z.infer<
  Awaited<ReturnType<NonNullable<T["execute"]>>>
>;

// biome-ignore lint/suspicious/noExplicitAny: template matching.
export type ToolOutputType<T extends Tool<any, any>> =
  | z.infer<Awaited<ReturnType<NonNullable<T["execute"]>>>>
  | {
      error: string;
    };

// biome-ignore lint/suspicious/noExplicitAny: template matching.
export type ToolFunctionType<T extends Tool<any, any>> = (
  args: ToolInputType<T>,
) => Promise<ToolOutputTypeNoError<T>>;
