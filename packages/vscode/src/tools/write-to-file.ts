import { setTimeout as setTimeoutPromise } from "node:timers/promises";
import { DiffView } from "@/integrations/editor/diff-view";
import { fixCodeGenerationOutput } from "@/tools/output-utils";
import type { ClientToolsType } from "@ragdoll/tools";
import type {
  PreviewToolFunctionType,
  ToolFunctionType,
} from "@ragdoll/tools/src/types";

export const previewWriteToFile: PreviewToolFunctionType<
  ClientToolsType["writeToFile"]
> = async (args, { state, toolCallId }) => {
  const { path, content } = args || {};
  if (path === undefined || content === undefined) return;

  const processedContent = fixCodeGenerationOutput(content);

  const diffView = await DiffView.getOrCreate(toolCallId, path);
  await diffView.update(processedContent, state !== "partial-call");
  if (state === "call") {
    await setTimeoutPromise(300); // wait for diff view to update
    diffView.scrollToFirstDiff();
  }
};

/**
 * Implements the writeToFile tool for VSCode extension.
 * Writes content to a specified file, creating directories if needed.
 */
export const writeToFile: ToolFunctionType<
  ClientToolsType["writeToFile"]
> = async ({ path, content }, { toolCallId }) => {
  const processedContent = fixCodeGenerationOutput(content);
  const diffView = await DiffView.getOrCreate(toolCallId, path);
  await diffView.update(processedContent, true);
  const edits = await diffView.saveChanges(path, processedContent);
  return { success: true, ...edits };
};
