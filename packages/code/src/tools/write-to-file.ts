import fs from "node:fs/promises";
import { dirname } from "node:path";
import type { WriteToFileFunctionType } from "@ragdoll/tools";

/**
 * Implements the writeToFile tool, which writes content to a specified file.
 * If the file exists, it overwrites the content. If it doesn't exist, it creates the file.
 */
export const writeToFile: WriteToFileFunctionType = async ({
  path,
  content,
}) => {
  try {
    // Ensure the directory exists
    const directory = dirname(path);
    await fs.mkdir(directory, { recursive: true });

    // Write the content to the file
    await fs.writeFile(path, content, "utf-8");
  } catch (error) {
    throw new Error(`Failed to write to file: ${error}`);
  }
};
