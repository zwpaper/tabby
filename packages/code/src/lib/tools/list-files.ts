import type { ListFilesFunctionType } from "@ragdoll/tools";
import { traverseBFS } from "./file-utils";

export const listFiles: ListFilesFunctionType = async ({ path, recursive }) => {
  return await traverseBFS(path, recursive || false, 300);
};
