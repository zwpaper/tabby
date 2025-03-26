import type { Environment } from "@/types";

export function getReadEnvironmentResult(environment: Environment) {
  const sections = [
    getCurrentTime(environment.currentTime),
    getWorkspaceFiles(environment.workspace),
  ]
    .filter(Boolean)
    .join("\n\n");
  return sections;
}

function getCurrentTime(currentTime: string | undefined) {
  if (currentTime) {
    return `# Current Time\n${currentTime}`;
  }
  return "";
}

function getWorkspaceFiles(workspace: Environment["workspace"]) {
  if (workspace) {
    const { files, isTruncated } = workspace;
    const filesList = files.join("\n");
    const truncatedMessage = isTruncated
      ? "\n(Note: The list of files is truncated. Use listFiles tool to explore if needed)"
      : "";
    return `# Current Working Directory (${workspace.cwd}) Files\n${filesList}${truncatedMessage}`;
  }
  return "";
}
