import { Mastra } from "@mastra/core";
 
import { tabby } from "./agents/tabby";
 
export const mastra = new Mastra({
  agents: { tabby },
});