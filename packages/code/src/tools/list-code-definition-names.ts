import type { ListCodeDefinitionNamesFunctionType } from "@ragdoll/tools";
import { traverseBFS } from "./file-utils";
import { readFile } from "./read-file";

export const listCodeDefinitionNames: ListCodeDefinitionNamesFunctionType = async ({
  path,
}) => {
  const { files } = await traverseBFS(path, false);
  const definitions: string[] = [];

  for (const file of files) {
    if (file.endsWith(".ts") || file.endsWith(".tsx")) {
      const { content } = await readFile({ path: file });
      const matches = content.match(/(class|function|interface|type) \w+/g);
      if (matches) {
        definitions.push(...matches.map((match) => match.split(" ")[1]));
      }
    }
  }

  return { definitions };
};