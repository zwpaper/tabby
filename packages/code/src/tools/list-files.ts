import { readdir } from 'fs/promises';
import { join } from 'path';

export async function listFiles({ path, recursive }: { path: string; recursive?: boolean }) {
  const result: string[] = [];

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
          result.push(fullPath);
        }

        if (result.length >= 300) {
          result.push(`(File list truncated. Use list_files on specific subdirectories if you need to explore further.)`);
          return; // Stop traversal if 300 files are collected
        }
      }
    }
  }

  await traverseBFS(path);
  return result;
  return result.slice(0, 300); // Ensure only 300 files are returned
}