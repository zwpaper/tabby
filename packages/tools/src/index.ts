export {
  ZodMcpTool,
  type McpTool,
} from "./mcp-tools";
import { applyDiff } from "./apply-diff";
import { askFollowupQuestion } from "./ask-followup-question";
import { attemptCompletion } from "./attempt-completion";
import { batchCall } from "./batch-call";
import { executeCommand } from "./execute-command";
import { globFiles } from "./glob-files";
import { listFiles } from "./list-files";
import { multiApplyDiff } from "./multi-apply-diff";
import { newTask } from "./new-task";
import { readFile } from "./read-file";
import { searchFiles } from "./search-files";
import { todoWrite } from "./todo-write";
export {
  ZodTodo,
  type Todo,
} from "./todo-write";
export type {
  ToolFunctionTypeV5,
  PreviewToolFunctionTypeV5,
} from "./types";
import { writeToFile } from "./write-to-file";
export type { SubTask } from "./new-task";

export function isUserInputTool(toolName: string): boolean {
  const userInputTools: string[] = [
    "askFollowupQuestion",
    "attemptCompletion",
  ] satisfies ToolName[];
  return userInputTools.includes(toolName);
}

export function isAutoApproveTool(toolName: string): boolean {
  return ToolsByPermission.default.includes(toolName);
}

type ToolName = keyof typeof ClientToolsV5;

export const ToolsByPermission = {
  read: [
    "readFile",
    "listFiles",
    "globFiles",
    "searchFiles",
  ] satisfies ToolName[] as string[],
  write: [
    "writeToFile",
    "applyDiff",
    "multiApplyDiff",
  ] satisfies ToolName[] as string[],
  execute: ["executeCommand", "newTask"] satisfies ToolName[] as string[],
  default: ["todoWrite"] satisfies ToolName[] as string[],
};

export const ServerToolApproved = "<server-tool-approved>";

export { BatchCallTools } from "./batch-call";

export const ClientToolsV5 = {
  applyDiff,
  askFollowupQuestion,
  attemptCompletion,
  executeCommand,
  globFiles,
  listFiles,
  multiApplyDiff,
  newTask,
  readFile,
  searchFiles,
  todoWrite,
  writeToFile,
  batchCall,
};

export type ClientToolsV5Type = typeof ClientToolsV5;

export const selectClientToolsNext = (enableNewTask: boolean) => {
  if (enableNewTask) {
    return {
      ...ClientToolsV5,
    };
  }

  const { newTask, ...rest } = ClientToolsV5;
  return rest;
};
