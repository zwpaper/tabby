import fs from "node:fs/promises";
import { fileTypeFromFile } from "file-type";
import { z } from "zod";
import { defineClientTool } from "./types";

export const { tool: readFile, execute: executeReadFile } = defineClientTool({
  description:
    "Request to read the contents of a file at the specified path. Use this when you need to examine the contents of an existing file you do not know the contents of, for example to analyze code, review text files, or extract information from configuration files.",
  inputSchema: z.object({
    path: z
      .string()
      .describe(
        "The path of the file to read (relative to the current working directory)",
      ),
    startLine: z
      .number()
      .optional()
      .describe(
        "The starting line number to read from (1-based). If not provided, it starts from the beginning of the file.",
      ),
    endLine: z
      .number()
      .optional()
      .describe(
        "The ending line number to read to (1-based, inclusive). If not provided, it reads to the end of the file.",
      ),
  }),
  outputSchema: z.object({
    content: z.string().describe("The contents of the file"),
    isTruncated: z
      .boolean()
      .describe(
        "Whether the content is truncated due to exceeding the maximum length",
      ),
  }),
  execute: async ({ path, startLine, endLine }) => {
    const type = await fileTypeFromFile(path);

    if (type && !type.mime.startsWith("text/")) {
      throw new Error(
        `The file is binary or not plain text (detected type: ${type.mime}).`,
      );
    }

    const fileBuffer = await fs.readFile(path);

    const fileContent = fileBuffer.toString("utf-8");
    const lines = fileContent.split("\n");

    const start = startLine ? startLine - 1 : 0;
    const end = endLine ? endLine : lines.length;

    // Select the relevant lines
    const selectedLines = lines.slice(start, end);

    // Add line numbers
    const numberedLines = selectedLines.map(
      (line, index) => `${start + index + 1} | ${line}`,
    );

    let contentWithLineNumbers = numberedLines.join("\n");

    let isTruncated = false;
    // Check byte length and truncate if necessary
    if (Buffer.byteLength(contentWithLineNumbers, "utf-8") > 1_048_576) {
      // This truncation might cut off mid-line or mid-number, which is a simplification.
      // A more robust solution would truncate line by line, but this matches the previous behavior's limit.
      contentWithLineNumbers = contentWithLineNumbers.slice(0, 1_048_576);
      isTruncated = true;
    }

    return { content: contentWithLineNumbers, isTruncated };
  },
});
