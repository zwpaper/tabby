import type { ListFilesFunctionType } from "@ragdoll/tools";
import { traverseBFS } from "./file-utils";

export const listFiles: ListFilesFunctionType = async ({ path, recursive }) => {
  const { files, isTruncated } = await traverseBFS(
    path,
    recursive || false,
    300,
  );
  return {
    files: files,
    isTruncated,
  };
};
