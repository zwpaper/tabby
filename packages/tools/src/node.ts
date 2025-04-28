import type { Tool, ToolExecutionOptions } from "ai";
import { applyDiff, executeApplyDiff } from "./apply-diff";
import { askFollowupQuestion } from "./ask-followup-question";
import { attemptCompletion } from "./attempt-completion";
import { executeCommand, executeExecuteCommand } from "./execute-command";
import { executeGlobFiles, globFiles } from "./glob-files";
import { executeListFiles, listFiles } from "./list-files";
import { readEnvironment } from "./read-environment";
import { executeReadFile, readFile } from "./read-file";
import { executeSearchFiles, searchFiles } from "./search-files";
import type { ToolFunctionType } from "./types";
import { executeWriteToFile, writeToFile } from "./write-to-file";

export const ClientTools = {
  applyDiff,
  askFollowupQuestion,
  attemptCompletion,
  executeCommand,
  listFiles,
  readFile,
  globFiles,
  searchFiles,
  writeToFile,
  readEnvironment,
};

// biome-ignore lint/suspicious/noExplicitAny: external tool args
const ExecuteClientTools: Record<string, ToolFunctionType<Tool<any, any>>> = {
  applyDiff: executeApplyDiff,
  executeCommand: executeExecuteCommand,
  listFiles: executeListFiles,
  readFile: executeReadFile,
  globFiles: executeGlobFiles,
  searchFiles: executeSearchFiles,
  writeToFile: executeWriteToFile,
};

export function executeClientTool(
  toolName: string,
  args: unknown,
  options: ToolExecutionOptions,
) {
  if (!(toolName in ExecuteClientTools)) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  return ExecuteClientTools[toolName](args, options).catch((e) => ({
    error: e.message,
  }));
}

export type ToolName = keyof typeof ClientTools;
