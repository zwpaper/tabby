import fs from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";
import { defineClientTool } from "./types";

export const { tool: writeToFile, execute: executeWriteToFile } =
  defineClientTool({
    description:
      "Request to write full content to a file at the specified path. If the file exists, it will be overwritten with the provided content. If the file doesn't exist, it will be created. This tool will automatically create any directories needed to write the file.",
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
    }),
    execute: async ({ path, content }) => {
      try {
        // Ensure the directory exists
        const directory = dirname(path);
        await fs.mkdir(directory, { recursive: true });

        // Write the content to the file
        await fs.writeFile(path, content, "utf-8");
        return { success: true };
      } catch (error) {
        throw new Error(`Failed to write to file: ${error}`);
      }
    },
  });
