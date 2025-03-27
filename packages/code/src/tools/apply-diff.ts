import fs from "node:fs/promises";
import type { ApplyDiffFunctionType } from "@ragdoll/tools";

export const applyDiff: ApplyDiffFunctionType = async ({ path, diff }) => {
  const fileContent = await fs.readFile(path, "utf-8");
  const diffBlocks = diff.split("<<<<<<< SEARCH");
  let updatedContent = fileContent;

  for (let i = 1; i < diffBlocks.length; i++) {
    const block = diffBlocks[i];
    const [metadata, rest] = block.split("-------\n");
    const [searchContent, replaceContent] = rest.split("\n=======\n");
    const endReplace = replaceContent.split("\n>>>>>>> REPLACE")[0];

    const startLine = Number.parseInt(
      metadata.split(":start_line:")[1].split(":")[0].trim(),
    );
    const endLine = Number.parseInt(
      metadata.split(":end_line:")[1].split(":")[0].trim(),
    );

    const lines = updatedContent.split("\n");
    const startIndex = startLine - 1;
    const endIndex = endLine - 1;

    const extractedLines = lines.slice(startIndex, endIndex + 1);
    const searchLines = searchContent
      .split("\n");

    if (
      extractedLines.length === searchLines.length &&
      extractedLines.every((line, index) => line.trim() === searchLines[index].trim())
    ) {
      lines.splice(
        startIndex,
        endIndex - startIndex + 1,
        ...endReplace.split("\n"),
      );
      updatedContent = lines.join("\n");
    } else {
      throw new Error(
        `Search content does not match the original file content.\nOriginal content:\n${extractedLines}\nSearch content:\n${searchLines}\n`,
      );
    }
  }

  await fs.writeFile(path, updatedContent, "utf-8");
  return true;
};
