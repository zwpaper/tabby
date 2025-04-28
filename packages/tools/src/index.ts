import type { ClientTools as ClientToolsImpl, ToolName } from "./node";
import type { ToolFunctionType } from "./types";

export type { ToolFunctionType };

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

export { defineServerTool } from "./types";

export type ClientToolsType = typeof ClientToolsImpl;
