import { tool, type Tool } from 'ai';

import { z } from "zod";

export function defineClientTool<PARAMETERS extends z.ZodTypeAny, RESULT extends z.ZodTypeAny>({ description, inputSchema }: { description: string, inputSchema: PARAMETERS, outputSchema: RESULT }): Tool<PARAMETERS, RESULT> {
    return tool({
        description,
        parameters: inputSchema,
    })
}

type ToolInputType<T extends Tool<any, any>> = z.infer<T["parameters"]>;
type ToolOutputType<T extends Tool<any, any>> = z.infer<Awaited<ReturnType<NonNullable<T["execute"]>>>>;

export type ToolFunctionType<T extends Tool<any, any>> = (args: ToolInputType<T>)=> Promise<ToolOutputType<T>>;