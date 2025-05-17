import { z } from "zod";

export const EditFileResultPrompt = `After the file is written, if the user makes any edits, the userEdits field will be present in the result. If the editor's auto formatter is making any edits, the autoFormattingEdits field will be present in the result.
You should pay special attention to these fields and apply the preferences in future operations.

Note that the file is already saved with userEdits and autoFormattingEdits applied; you don't need to edit it again unless for other reasons (e.g., resolving a new problem).`;

export const EditFileOutputSchema = z.object({
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
});
