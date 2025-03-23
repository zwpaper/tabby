import { join } from "path";
import type { ListFilesFunctionType } from "@ragdoll/tools";
import { readdir } from "fs/promises";

export const listFiles: ListFilesFunctionType = async ({ path, recursive }) => {
  let isTruncated = false;
  const files: string[] = [];

  async function traverseBFS(directory: string) {
    const queue: string[] = [directory];
    const dirsToIgnore = [
      "node_modules",
      "__pycache__",
      "env",
      "venv",
      "target/dependency",
      "build/dependencies",
      "dist",
      "out",
      "bundle",
      "vendor",
      "tmp",
      "temp",
      "deps",
      "pkg",
      "Pods",
      ".*", // '!**/.*' excludes hidden directories, while '!**/.*/**' excludes only their contents. This way we are at least aware of the existence of hidden directories.
    ];

    while (queue.length > 0) {
      const currentDir = queue.shift()!;
      const entries = await readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(currentDir, entry.name);

        if (dirsToIgnore.some((dir) => entry.name === dir)) {
          continue; // Skip ignored directories and files
        }

        if (entry.isDirectory() && recursive) {
          queue.push(fullPath);
        } else if (entry.isFile()) {
          files.push(fullPath);
        }

        if (files.length >= 300) {
          isTruncated = true;
          return; // Stop traversal if 300 files are collected
        }
      }
    }
  }

  await traverseBFS(path);
  return {
    files: files,
    isTruncated,
  };
};
