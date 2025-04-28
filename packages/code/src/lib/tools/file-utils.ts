import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { dirsToIgnore } from "./constants";

export async function traverseBFS(
  directory: string,
  recursive: boolean,
  maxItems = 0,
): Promise<{ files: string[]; isTruncated: boolean }> {
  const files: string[] = [];
  const queue: string[] = [directory];
  let isTruncated = false;

  while (queue.length > 0) {
    // biome-ignore lint/style/noNonNullAssertion: checked in while loop
    const currentDir = queue.shift()!;
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);

      if (dirsToIgnore.some((dir) => entry.name === dir)) {
        continue;
      }

      if (entry.isDirectory() && recursive) {
        queue.push(fullPath);
      }
      files.push(fullPath);

      if (maxItems > 0 && files.length >= maxItems) {
        isTruncated = true;
        return { files, isTruncated };
      }
    }
  }

  return { files, isTruncated };
}
