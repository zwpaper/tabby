import * as diff from "diff";

export function createPrettyPatch(
  filename = "file",
  oldStr?: string,
  newStr?: string,
) {
  const patch = diff.createPatch(filename, oldStr || "", newStr || "");
  const lines = patch.split("\n");
  const prettyPatchLines = lines.slice(4);
  return prettyPatchLines.join("\n");
}
