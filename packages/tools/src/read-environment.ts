import { z } from "zod";
import { type ToolFunctionType, defineClientTool } from "./types";

export const { tool: readEnvironment } = defineClientTool({
  description:
    "Read the system environment of the user, which includes details such as the file structure of the current working directory, etc.",
  inputSchema: z.object({}),
  outputSchema: z.string(),
  execute: async () => {
    throw new Error("Not implemented");
  },
});

export type ReadEnvironmentFunctionType = ToolFunctionType<
  typeof readEnvironment
>;
