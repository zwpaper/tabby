import path from "node:path";
import type { GlobFilesFunctionType } from "@ragdoll/tools";
import { glob } from "glob";

// Define a limit for the number of files returned
const MAX_FILES = 300;

export const globFiles: GlobFilesFunctionType = async ({
  path: searchPath,
  globPattern,
}) => {
  // Ensure the search path is treated as a directory
  const absoluteSearchPath = path.resolve(searchPath);

  // Use glob to find files matching the pattern within the specified directory
  // The `cwd` option ensures the pattern is matched relative to the search path
  // `nodir: true` ensures only files are returned, not directories
  let files = await glob(globPattern, {
    cwd: absoluteSearchPath,
    nodir: true,
    absolute: false, // Keep paths relative to cwd
  });

  let isTruncated = false;
  if (files.length > MAX_FILES) {
    files = files.slice(0, MAX_FILES);
    isTruncated = true;
  }

  // Return the list of relative file paths and the truncation status
  return { files, isTruncated };
};
