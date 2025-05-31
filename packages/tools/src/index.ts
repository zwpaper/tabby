export { defineServerTool } from "./types";
export {
  ZodMcpToolType,
  parseMcpToolSet,
} from "./mcp-tools";
import { applyDiff } from "./apply-diff";
import { askFollowupQuestion } from "./ask-followup-question";
import { attemptCompletion } from "./attempt-completion";
import { executeCommand } from "./execute-command";
import { globFiles } from "./glob-files";
import { listFiles } from "./list-files";
import { multiApplyDiff } from "./multi-apply-diff";
import { readFile } from "./read-file";
import { searchFiles } from "./search-files";
import { todoWrite } from "./todo-write";
export type { PreviewToolFunctionType, ToolFunctionType } from "./types";
import type { Tool, ToolInvocation } from "ai";
import { slackReplyThread } from "./slack-reply-thread";
import { webFetch } from "./web-fetch";
import { writeToFile } from "./write-to-file";

export function isUserInputTool(toolName: string): boolean {
  const userInputTools: string[] = [
    "askFollowupQuestion",
    "attemptCompletion",
  ] satisfies ToolName[];
  return userInputTools.includes(toolName);
}

export function isExecuteCommandToolStreamCall(tool: ToolInvocation): boolean {
  return tool.toolName === "executeCommand";
}

export function isAutoInjectTool(toolName: string): boolean {
  const autoInjectTools: string[] = [] satisfies ToolName[];
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
  todoWrite,
  multiApplyDiff,
};

export type ClientToolsType = typeof ClientTools;

export const ServerTools = {
  webFetch,
  slackReplyThread,
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
  execute: ["executeCommand"] satisfies ToolName[] as string[],
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
