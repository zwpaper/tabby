import type { ApplyDiffFunctionType } from "@ragdoll/tools";
import fs from "node:fs/promises";

export const applyDiff: ApplyDiffFunctionType = async ({ path, diff }) => {
  const fileContent = await fs.readFile(path, "utf-8");
  const [search, replace] = diff.split("=======");

  if (!search || !replace) {
    throw new Error("Invalid diff format. Ensure it contains '=======' separator.");
  }

  const updatedContent = fileContent.replace(search, replace);

  if (updatedContent === fileContent) {
    throw new Error("No changes were made. The search content was not found.");
  }

  await fs.writeFile(path, updatedContent, "utf-8");
};