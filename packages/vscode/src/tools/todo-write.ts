import type { ClientToolsV5Type, ToolFunctionTypeV5 } from "@getpochi/tools";

/**
 * Implements the writeToFile tool for VSCode extension.
 * Writes content to a specified file, creating directories if needed.
 */
export const todoWrite: ToolFunctionTypeV5<
  ClientToolsV5Type["todoWrite"]
> = async () => {
  return {
    success: true,
  };
};
