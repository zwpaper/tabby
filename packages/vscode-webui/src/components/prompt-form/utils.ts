/**
 * Extracts basename and formats path for display
 */
export function formatPathForDisplay(filepath: string): {
  basename: string;
  displayPath: string;
} {
  // FIXME: hack way to handle both Unix and Windows paths
  const separator = filepath.includes("\\") ? "\\" : "/";
  const parts = filepath.split(separator);
  const basename = parts[parts.length - 1];

  // Format display path (excluding basename)
  const displayPath = parts.slice(0, -1).join(separator);

  return { basename, displayPath };
}
