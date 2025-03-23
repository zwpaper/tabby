import type { SearchFilesFunctionType } from "@ragdoll/tools";
import { traverseBFS } from "./file-utils";
import { readFile } from "./read-file";

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
    const { content } = await readFile({ path: file });
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
