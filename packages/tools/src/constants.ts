import { z } from "zod";

export const EditFileResultPrompt =
  `You may see the following fields in the result:
- userEdits: If the user makes any edits, this field will contain a diff between your edit and their changes.
- autoFormattingEdits: If the auto-formatter makes any changes, this field will contain a diff against the file content after your edits and any user edits have been applied.
- newProblems: If any new problems are found after the edit, this field will contain information about them.
`.trim();

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
