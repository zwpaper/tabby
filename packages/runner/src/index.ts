export type { TaskRunnerProgress } from "./task-runner";
import type { TaskRunnerProgress } from "./task-runner";

export function asReadableMessage(progress: TaskRunnerProgress): string {
  switch (progress.type) {
    case "loading-task":
      if (progress.phase === "begin") {
        return `[Step ${progress.step}] Loading task...`;
      }
      if (progress.phase === "end") {
        return `[Step ${progress.step}] Task loaded successfully.`;
      }
      break;
    case "executing-tool-call":
      if (progress.phase === "begin") {
        return `[Step ${progress.step}] Executing tool: ${progress.toolName}`;
      }
      if (progress.phase === "end") {
        const error =
          typeof progress.toolResult === "object" &&
          progress.toolResult !== null &&
          "error" in progress.toolResult &&
          progress.toolResult.error
            ? progress.toolResult.error
            : undefined;
        return `[Step ${progress.step}] Tool ${progress.toolName} ${error ? "✗" : "✓"}${error ? ` (${error})` : ""}`;
      }
      break;
    case "sending-result":
      if (progress.phase === "begin") {
        return `[Step ${progress.step}] Sending result...`;
      }
      if (progress.phase === "end") {
        return `[Step ${progress.step}] Result sent successfully.`;
      }
      break;
    case "step-completed":
      return `[Step ${progress.step}] Step completed with status: ${progress.status}`;
    case "runner-stopped":
      return `Task runner stopped with final status: ${progress.status}`;
    default:
      return "";
  }
  return "";
}
