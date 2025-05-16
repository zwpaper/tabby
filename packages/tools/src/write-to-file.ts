import { z } from "zod";
import { defineClientTool } from "./types";

export const writeToFile = defineClientTool({
  description: `Request to write full content to a file at the specified path.
If the file exists, it will be overwritten with the provided content.
If the file doesn't exist, it will be created. This tool will automatically create any directories needed to write the file.

After the file is written, if the user edits the file, userEdits field will present in result. You should pay a special attention to it and apply the preference in future operations`,
  inputSchema: z.object({
    path: z
      .string()
      .describe(
        "The path of the file to write to (relative to the current working directory).",
      ),
    content: z.string().describe("The content to write to the file."),
  }),
  outputSchema: z.object({
    success: z
      .boolean()
      .describe("Indicates whether the file was successfully written."),

    userEdits: z
      .string()
      .describe(
        "The user's edits to the file, only present if the file was edited by the user.",
      )
      .optional(),

    autoFormattingEdits: z
      .string()
      .describe(
        "The auto-formatting edits to the file, only present if the auto formatter made changes.",
      )
      .optional(),

    newProblems: z
      .string()
      .optional()
      .describe("The new problems found after writing the file, if any."),
  }),
});
