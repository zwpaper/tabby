export type { ApplyDiffFunctionType } from "./apply-diff";
export type { AskFollowupQuestionFunctionType } from "./ask-followup-question";
export type { AttemptCompletionFunctionType } from "./attempt-completion";
export type { ExecuteCommandFunctionType } from "./execute-command";
export type { GlobFilesFunctionType } from "./glob-files";
export type { ListFilesFunctionType } from "./list-files";
export type { ReadFileFunctionType } from "./read-file";
export type { SearchFilesFunctionType } from "./search-files";
export type { WriteToFileFunctionType } from "./write-to-file";

import { applyDiff } from "./apply-diff";
import { askFollowupQuestion } from "./ask-followup-question";
import { attemptCompletion } from "./attempt-completion";
import { executeCommand } from "./execute-command";
import { globFiles } from "./glob-files";
import { listFiles } from "./list-files";
import { readEnvironment } from "./read-environment";
import { readFile } from "./read-file";
import { searchFiles } from "./search-files";
import { writeToFile } from "./write-to-file";

export const Tools = {
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

export function isUserInputTool(toolName: string) {
  if (toolName === "askFollowupQuestion") return true;
  if (toolName === "attemptCompletion") return true;
  return false;
}

export function isAutoInjectTool(toolName: string) {
  if (toolName === "readEnvironment") return true;
  return false;
}

export { defineServerTool } from "./types";
