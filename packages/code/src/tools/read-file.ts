import fs from "node:fs/promises";
import type { ReadFileFunctionType } from "@ragdoll/tools";

import { fileTypeFromFile } from "file-type";

export const readFile: ReadFileFunctionType = async ({
  path,
  startLine,
  endLine,
}) => {
  const type = await fileTypeFromFile(path);

  if (type && !type.mime.startsWith("text/")) {
    throw new Error(
      `The file is binary or not plain text (detected type: ${type.mime}).`,
    );
  }

  const fileBuffer = await fs.readFile(path);

  const fileContent = fileBuffer.toString("utf-8");
  const lines = fileContent.split("\n");

  const start = startLine ? startLine - 1 : 0;
  const end = endLine ? endLine : lines.length;

  let selectedLines = lines.slice(start, end).join("\n");

  let isTruncated = false;
  if (Buffer.byteLength(selectedLines, "utf-8") > 1_048_576) {
    selectedLines = selectedLines.slice(0, 1_048_576);
    isTruncated = true;
  }

  return { content: selectedLines, isTruncated };
};
