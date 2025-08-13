export { defineServerTool } from "./types";
export {
  ZodMcpTool,
  type McpTool,
} from "./mcp-tools";
import { applyDiff, applyDiffV5 } from "./apply-diff";
import {
  askFollowupQuestion,
  askFollowupQuestionV5,
} from "./ask-followup-question";
import { attemptCompletion, attemptCompletionV5 } from "./attempt-completion";
import { batchCall, batchCallV5 } from "./batch-call";
import { executeCommand, executeCommandV5 } from "./execute-command";
import { globFiles, globFilesV5 } from "./glob-files";
import { listFiles, listFilesV5 } from "./list-files";
import { multiApplyDiff, multiApplyDiffV5 } from "./multi-apply-diff";
import { newTask, newTaskV5 } from "./new-task";
import { readFile, readFileV5 } from "./read-file";
import { searchFiles, searchFilesV5 } from "./search-files";
import { todoWrite, todoWriteV5 } from "./todo-write";
export {
  ZodTodo,
  type Todo,
} from "./todo-write";
export type {
  ToolFunctionTypeV5,
  PreviewToolFunctionTypeV5,
} from "./types";
import type { Tool } from "ai";
import { webFetch } from "./web-fetch";
import { writeToFile, writeToFileV5 } from "./write-to-file";
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

export const ClientTools = {
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
};

export const ServerTools = {
  webFetch,
  batchCall,
};

type ToolName = keyof typeof ClientTools | keyof typeof ServerTools;

export const ToolsByPermission = {
  read: [
    "readFile",
    "listFiles",
    "globFiles",
    "searchFiles",
    "webFetch",
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

export const selectServerTools = (tools: string[]) => {
  const ret: Record<string, Tool> = {};
  for (const tool of tools) {
    if (!(tool in ServerTools)) {
      throw new Error(`Tool ${tool} not found`);
    }

    ret[tool] = ServerTools[tool as keyof typeof ServerTools];
  }

  return ret;
};

export { BatchCallTools } from "./batch-call";

export const selectClientTools = (enableNewTask: boolean) => {
  if (enableNewTask) {
    return {
      ...ClientTools,
    };
  }

  const { newTask, ...rest } = ClientTools;
  return rest;
};

export const ClientToolsV5 = {
  applyDiff: applyDiffV5,
  askFollowupQuestion: askFollowupQuestionV5,
  attemptCompletion: attemptCompletionV5,
  executeCommand: executeCommandV5,
  globFiles: globFilesV5,
  listFiles: listFilesV5,
  multiApplyDiff: multiApplyDiffV5,
  newTask: newTaskV5,
  readFile: readFileV5,
  searchFiles: searchFilesV5,
  todoWrite: todoWriteV5,
  writeToFile: writeToFileV5,
  batchCall: batchCallV5,
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
