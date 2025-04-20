import type { DB } from "../db";
import type { Environment } from "../types";

export function getReadEnvironmentResult(
  environment: Environment,
  event: DB["task"]["event"],
) {
  const sections = [
    getCurrentTime(environment.currentTime),
    getWorkspaceFiles(environment.workspace, environment.info),
    getEvent(event),
  ]
    .filter(Boolean)
    .join("\n\n");
  return sections;
}

function getCurrentTime(currentTime: string) {
  if (currentTime) {
    return `# Current Time\n${currentTime}`;
  }
  return "";
}

function getWorkspaceFiles(
  workspace: Environment["workspace"],
  info: Environment["info"],
) {
  const { files, isTruncated } = workspace;
  const filesList = files.join("\n");
  const truncatedMessage = isTruncated
    ? "\n(Note: The list of files is truncated. Use listFiles tool to explore if needed)"
    : "";
  return `# Current Working Directory (${info.cwd}) Files\n${filesList}${truncatedMessage}`;
}

function getEvent(event: DB["task"]["event"]) {
  if (event) {
    return `# Event triggered this task\n${JSON.stringify(event, null, 2)}`;
  }
  return "";
}
