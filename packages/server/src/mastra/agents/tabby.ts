import { generateSystemPrompt } from "@/prompts";
import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core";
import { listFiles } from "../tools/list-files";

export const tabby = new Agent({
  name: "Tabby",
  instructions: generateSystemPrompt(),
  model: openai("gpt-4o-mini"),
  tools: {
    listFiles
  }
});