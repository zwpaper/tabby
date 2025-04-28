import { z } from "zod";
import { defineClientTool } from "./types";

export const readEnvironment = defineClientTool({
  description:
    "Read the system environment of the user, which includes details such as the file structure of the current working directory, etc.",
  inputSchema: z.object({}),
  outputSchema: z.string(),
});
