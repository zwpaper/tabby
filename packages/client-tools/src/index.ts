import { z } from "zod";
import { applyDiffTool } from "./apply-diff";
import { askFollowupQuestionTool } from "./ask-followup-question";
import { attemptCompletionTool } from "./attempt-completion";
import { executeCommandTool } from "./execute-command";
import { listCodeDefinitionNamesTool } from "./list-code-definition-names";
import { listFilesTool } from "./list-files";
import { readFileTool } from "./read-file";
import { searchFilesTool } from "./search-files";
import { writeToFileTool } from "./write-to-file";
import { Tool } from "@mastra/core";

type ToolInput<T extends Tool<any, any>> = T["inputSchema"] extends z.ZodSchema
    ? z.infer<T["inputSchema"]>
    : undefined;

type ToolOutput<T extends Tool<any, any>> = T["outputSchema"] extends z.ZodSchema
    ? z.infer<T["outputSchema"]>
    : undefined;

type ToolImplementation<T extends Tool<any, any>> = (input: ToolInput<T>) => Promise<ToolOutput<T>>;

export const ToolsRegistry = {
    applyDiff: applyDiffTool,
    askFollowupQuestion: askFollowupQuestionTool,
    attemptCompletion: attemptCompletionTool,
    executeCommand: executeCommandTool,
    listCodeDefinitionNames: listCodeDefinitionNamesTool,
    listFiles: listFilesTool,
    readFile: readFileTool,
    searchFiles: searchFilesTool,
    writeToFile: writeToFileTool,
};

interface ToolImplementations {
    applyDiff?: ToolImplementation<typeof applyDiffTool>,
    askFollowupQuestion?: ToolImplementation<typeof askFollowupQuestionTool>,
    attemptCompletion?: ToolImplementation<typeof attemptCompletionTool>,
    executeCommand?: ToolImplementation<typeof executeCommandTool>,
    listCodeDefinitionNames?: ToolImplementation<typeof listCodeDefinitionNamesTool>,
    listFiles?: ToolImplementation<typeof listFilesTool>,
    readFile?: ToolImplementation<typeof readFileTool>,
    searchFiles?: ToolImplementation<typeof searchFilesTool>,
    writeToFile?: ToolImplementation<typeof writeToFileTool>,
}

export function createOnToolCall(impls: ToolImplementations) {
    return async function onToolCall(
        { toolCall: { toolName, args } }: { toolCall: { toolName: string, args: unknown } }
    ): Promise<unknown> {
        const impl = impls[toolName];
        if (!impl) {
            throw new Error(`No implementation provided for tool '${toolName}'`);
        }
        const output = await impl(args);
        return output;
    };
}