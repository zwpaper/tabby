import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core";
import { listFilesTool } from "@/mastra/tools/list-files";
import { generateSystemPrompt } from "@/prompts";

export const tabby = new Agent({
  name: "Tabby",
  instructions: generateSystemPrompt(),
  model: openai("gpt-4o-mini"),
  tools: { listFilesTool },
});