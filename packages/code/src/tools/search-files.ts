import fs from "node:fs/promises";
import type { SearchFilesFunctionType } from "@ragdoll/tools";
import { fileTypeFromFile } from "file-type";
import { traverseBFS } from "./file-utils";

export const searchFiles: SearchFilesFunctionType = async ({
  path,
  regex,
  filePattern,
}) => {
  const files: string[] = [];
  const matches: { file: string; line: number; context: string }[] = [];

  const { files: traversedFiles } = await traverseBFS(path, true);
  files.push(
    ...traversedFiles.filter(
      (file) => !filePattern || file.endsWith(filePattern),
    ),
  );

  const regexPattern = new RegExp(regex, "g");

  for (const file of files) {
    const type = await fileTypeFromFile(file);
    if (type && !type.mime.startsWith("text/")) {
      continue;
    }
    const buffer = await fs.readFile(path);
    const content = buffer.toString("utf-8");

    const lines = content.split("\n");

    lines.forEach((lineContent, index) => {
      if (regexPattern.test(lineContent)) {
        matches.push({
          file,
          line: index + 1,
          context: lineContent,
        });
      }
    });
  }

  return { matches };
};
