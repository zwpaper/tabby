export type { ToolFunctionType };
export { defineServerTool } from "./types";
import { applyDiff } from "./apply-diff";
import { askFollowupQuestion } from "./ask-followup-question";
import { attemptCompletion } from "./attempt-completion";
import { executeCommand } from "./execute-command";
import { globFiles } from "./glob-files";
import { listFiles } from "./list-files";
import { readEnvironment } from "./read-environment";
import { readFile } from "./read-file";
import { searchFiles } from "./search-files";
import type { ToolFunctionType } from "./types";
import { writeToFile } from "./write-to-file";

export function isUserInputTool(toolName: string): boolean {
  const userInputTools: string[] = [
    "askFollowupQuestion",
    "attemptCompletion",
  ] satisfies ToolName[];
  return userInputTools.includes(toolName);
}

export function isAutoInjectTool(toolName: string): boolean {
  const autoInjectTools: string[] = ["readEnvironment"] satisfies ToolName[];
  return autoInjectTools.includes(toolName);
}

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

type ToolName = keyof typeof ClientTools;

export const ToolsByPermission = {
  read: [
    "readFile",
    "listFiles",
    "globFiles",
    "searchFiles",
  ] satisfies ToolName[] as string[],
  write: ["writeToFile", "applyDiff"] satisfies ToolName[] as string[],
  execute: ["executeCommand"] satisfies ToolName[] as string[],
};

export type ClientToolsType = typeof ClientTools;
