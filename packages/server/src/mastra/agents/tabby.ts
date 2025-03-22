import { generateSystemPrompt } from "@/prompts";
import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core";
import { ToolsRegistry } from "@ragdoll/client-tools";

export const tabby = new Agent({
  name: "Tabby",
  instructions: generateSystemPrompt(),
  model: openai("gpt-4o-mini"),
  tools: {
    ToolsRegistry
  },
});