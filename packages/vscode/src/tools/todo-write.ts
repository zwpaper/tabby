import type { ClientToolsType, ToolFunctionType } from "@getpochi/tools";

/**
 * Implements the writeToFile tool for VSCode extension.
 * Writes content to a specified file, creating directories if needed.
 */
export const todoWrite: ToolFunctionType<
  ClientToolsType["todoWrite"]
> = async () => {
  return {
    success: true,
  };
};
