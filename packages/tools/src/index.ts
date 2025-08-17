export {
  ZodMcpTool,
  type McpTool,
} from "./mcp-tools";
import type { ToolUIPart, UIDataTypes, UIMessagePart, UITools } from "ai";
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
  ToolFunctionType,
  PreviewToolFunctionType,
} from "./types";
import { writeToFile } from "./write-to-file";
export type { SubTask } from "./new-task";

export function isUserInputToolPart(part: UIMessagePart<UIDataTypes, UITools>) {
  return (
    part.type === "tool-askFollowupQuestion" ||
    part.type === "tool-attemptCompletion"
  );
}

export function isAutoApproveTool(part: ToolUIPart): boolean {
  return ToolsByPermission.default.some((tool) => part.type === `tool-${tool}`);
}

type ToolName = keyof typeof ClientTools;

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
  batchCall,
};

export type ClientTools = typeof ClientTools;

export const selectClientTools = (enableNewTask: boolean) => {
  if (enableNewTask) {
    return {
      ...ClientTools,
    };
  }

  const { newTask, ...rest } = ClientTools;
  return rest;
};
