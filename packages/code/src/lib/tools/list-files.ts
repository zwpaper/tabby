import type { ClientToolsType, ToolFunctionType } from "@ragdoll/tools";
import { traverseBFS } from "./file-utils";

export const listFiles: ToolFunctionType<
  ClientToolsType["listFiles"]
> = async ({ path, recursive }) => {
  return await traverseBFS(path, recursive || false, 300);
};
