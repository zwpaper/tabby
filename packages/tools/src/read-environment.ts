import { z } from "zod";
import { type ToolFunctionType, declareClientTool } from "./types";

export const readEnvironment = declareClientTool({
  description:
    "Read the system environment of the user, which includes details such as the file structure of the current working directory, etc.",
  inputSchema: z.object({}),
  outputSchema: z.string(),
});

export type ReadEnvironmentFunctionType = ToolFunctionType<
  typeof readEnvironment
>;
