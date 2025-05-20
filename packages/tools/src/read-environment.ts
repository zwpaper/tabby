import { z } from "zod";
import { defineClientTool } from "./types";

export const readEnvironment = defineClientTool({
  description:
    "Read the system environment of the user, including details such as the file structure of the current working directory. This tool is passively triggered and should not be called directly.",
  inputSchema: z.object({}),
  outputSchema: z.string(),
});
