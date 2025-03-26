import fs from "node:fs/promises";
import type { ApplyDiffFunctionType } from "@ragdoll/tools";

export const applyDiff: ApplyDiffFunctionType = async ({ path, diff }) => {
  const fileContent = await fs.readFile(path, "utf-8");
  const diffBlocks = diff.split("<<<<<<< SEARCH");
  let updatedContent = fileContent;

  for (let i = 1; i < diffBlocks.length; i++) {
    const block = diffBlocks[i];
    const [metadata, rest] = block.split("-------");
    const [searchContent, replaceContent] = rest.split("=======");
    const endReplace = replaceContent.split(">>>>>>> REPLACE")[0];

    const startLine = parseInt(metadata.split(":start_line:")[1].split(":")[0].trim());
    const endLine = parseInt(metadata.split(":end_line:")[1].split(":")[0].trim());

    const lines = updatedContent.split("\n");

    const startIndex = startLine - 1;
    const endIndex = endLine - 1;

    const extractedContent = lines.slice(startIndex, endIndex + 1).join("\n");

    if (extractedContent === searchContent.trim()) {
      lines.splice(startIndex, endIndex - startIndex + 1, ...endReplace.trim().split("\n"));
      updatedContent = lines.join("\n");
    } else {
      console.error("Search content does not match the original file content.");
      return false;
    }
  }

  await fs.writeFile(path, updatedContent, "utf-8");
  return true;
};