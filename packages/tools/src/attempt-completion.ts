import { z } from "zod";
import { defineClientTool, ToolFunctionType } from './types';

export const attemptCompletion = defineClientTool({
    description: "After each tool use, the user will respond with the result of that tool use. Once you've received the results of tool uses and can confirm that the task is complete, use this tool to present the result of your work to the user.",
    inputSchema: z.object({
        result: z.string().describe("The result of the task. Formulate this result in a way that is final and does not require further input from the user."),
        command: z.string().optional().describe("A CLI command to execute to show a live demo of the result to the user."),
    }),
    outputSchema: z.object({
        success: z.boolean().describe("Indicates whether the completion was successful."),
    }),
});

export type AttemptCompletionFunctionType = ToolFunctionType<typeof attemptCompletion>;