import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core";
import {
  listFilesTool,
  applyDiffTool,
  listCodeDefinitionNamesTool,
  readFileTool,
  searchFilesTool,
  writeToFileTool,
  executeCommandTool,
  askFollowupQuestionTool,
  attemptCompletionTool
} from "@ragdoll/client-tools";
import { generateSystemPrompt } from "@/prompts";

export const tabby = new Agent({
  name: "Tabby",
  instructions: generateSystemPrompt(),
  model: openai("gpt-4o-mini"),
  tools: {
    listFilesTool,
    applyDiffTool,
    listCodeDefinitionNamesTool,
    readFileTool,
    searchFilesTool,
    writeToFileTool,
    executeCommandTool,
    askFollowupQuestionTool,
    attemptCompletionTool
  },
});